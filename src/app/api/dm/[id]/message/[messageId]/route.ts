import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { DM_MAX_LEN, snippet } from "@/lib/dm";
import { canEditMessage } from "@/lib/chat-view";
import { broadcastEvent, userChannel } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; messageId: string }> };

/**
 * Load a message together with the conversation it belongs to, and confirm the
 * caller is one of the two participants.
 *
 * The conversation check is the whole authorisation story here: a DM has no
 * moderators and no public audience, so "am I in this conversation" is the only
 * question, and it has to be asked from the message's own conversation rather
 * than from the id in the URL - otherwise a valid message id from someone
 * else's thread, paired with a conversation id of mine, would pass.
 */
async function loadMine(conversationId: string, messageId: string, myId: string) {
  const msg = await prisma.directMessage.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      body: true,
      senderId: true,
      status: true,
      createdAt: true,
      pinnedAt: true,
      conversationId: true,
      conversation: { select: { id: true, userAId: true, userBId: true, lastSenderId: true } },
    },
  });
  if (!msg || msg.conversationId !== conversationId) return null;
  const c = msg.conversation;
  if (c.userAId !== myId && c.userBId !== myId) return null;
  return msg;
}

/** The other participant, for the realtime ping. */
const otherId = (c: { userAId: string; userBId: string }, myId: string) =>
  c.userAId === myId ? c.userBId : c.userAId;

const editSchema = z.object({ body: z.string().trim().min(1).max(DM_MAX_LEN) });

// PATCH - edit your own message, inside the same 15-minute window the community
// chat uses. Kept identical on purpose: two different edit windows in one
// product is a rule nobody can remember.
export async function PATCH(req: Request, props: Ctx) {
  const params = await props.params;
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!isCuid(params.id) || !isCuid(params.messageId)) return fail("Invalid id.", 400);

    const { success } = await rateLimit("dm", me.id);
    if (!success) return fail("You're doing that too fast. Take a breath.", 429);

    const parsed = editSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid message.", 400);

    const msg = await loadMine(params.id, params.messageId, me.id);
    if (!msg || msg.status !== "visible") return fail("Message not found.", 404);
    if (msg.senderId !== me.id) return fail("You can only edit your own messages.", 403);
    if (!canEditMessage(msg.createdAt)) {
      return fail("Messages can only be edited within 15 minutes of sending.", 403);
    }

    const editedAt = new Date();
    await prisma.directMessage.update({
      where: { id: msg.id },
      data: { body: parsed.data.body, editedAt },
    });

    // Keep the inbox preview honest when the edited message was the last one.
    if (msg.conversation.lastSenderId === me.id) {
      await prisma.conversation
        .update({ where: { id: msg.conversationId }, data: { lastBody: snippet(parsed.data.body) } })
        .catch(() => null);
    }

    await broadcastEvent(userChannel(otherId(msg.conversation, me.id)), "dm_message", {
      conversationId: msg.conversationId,
    });
    return ok({ ok: true, body: parsed.data.body, editedAt: editedAt.toISOString() });
  } catch (err) {
    return handleError(err, "dm:edit");
  }
}

// DELETE - remove your own message. Soft: the row stays, so the thread keeps
// its shape and a reported message is still there to look at afterwards.
//
// Only the author. A DM has two participants and no moderator, and letting the
// other side delete your words would be a worse feature than having none.
export async function DELETE(_req: Request, props: Ctx) {
  const params = await props.params;
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!isCuid(params.id) || !isCuid(params.messageId)) return fail("Invalid id.", 400);

    const { success } = await rateLimit("dm", me.id);
    if (!success) return fail("You're doing that too fast. Take a breath.", 429);

    const msg = await loadMine(params.id, params.messageId, me.id);
    if (!msg || msg.status !== "visible") return fail("Message not found.", 404);
    if (msg.senderId !== me.id) return fail("You can only delete your own messages.", 403);

    await prisma.directMessage.update({
      where: { id: msg.id },
      // Unpinned as well: a pinned banner pointing at a deleted message is a
      // dead end the reader cannot clear themselves.
      data: { status: "deleted", pinnedAt: null },
    });

    // If that was the last message, the inbox preview now describes something
    // that is gone.
    if (msg.conversation.lastSenderId === me.id) {
      await prisma.conversation
        .update({ where: { id: msg.conversationId }, data: { lastBody: "Message deleted" } })
        .catch(() => null);
    }

    await broadcastEvent(userChannel(otherId(msg.conversation, me.id)), "dm_message", {
      conversationId: msg.conversationId,
    });
    return ok({ ok: true });
  } catch (err) {
    return handleError(err, "dm:delete");
  }
}

const pinSchema = z.object({ pinned: z.boolean() });

// POST - pin or unpin, for either participant. Unlike edit and delete this is
// not restricted to the author: a pin marks what matters *to this conversation*
// (an address, a deadline), and half the time that is the other person's
// message. One pin per conversation, so pinning replaces the previous one.
export async function POST(req: Request, props: Ctx) {
  const params = await props.params;
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!isCuid(params.id) || !isCuid(params.messageId)) return fail("Invalid id.", 400);

    const { success } = await rateLimit("dm", me.id);
    if (!success) return fail("You're doing that too fast. Take a breath.", 429);

    const parsed = pinSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Invalid request.", 400);

    const msg = await loadMine(params.id, params.messageId, me.id);
    if (!msg || msg.status !== "visible") return fail("Message not found.", 404);

    if (parsed.data.pinned) {
      // Clear the old pin first so the banner query never has to pick between
      // two, and so "pinned" reads as one slot rather than a growing list.
      await prisma.directMessage.updateMany({
        where: { conversationId: msg.conversationId, pinnedAt: { not: null } },
        data: { pinnedAt: null },
      });
      await prisma.directMessage.update({ where: { id: msg.id }, data: { pinnedAt: new Date() } });
    } else {
      await prisma.directMessage.update({ where: { id: msg.id }, data: { pinnedAt: null } });
    }

    await broadcastEvent(userChannel(otherId(msg.conversation, me.id)), "dm_message", {
      conversationId: msg.conversationId,
    });
    return ok({ ok: true, pinned: parsed.data.pinned });
  } catch (err) {
    return handleError(err, "dm:pin");
  }
}
