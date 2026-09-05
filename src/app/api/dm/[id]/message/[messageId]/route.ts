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

// DELETE - remove a message, in one of two senses.
//
//   ?scope=me        removes it from MY view only. The row stays, the other
//                    side is unaffected and is not even told. Any message.
//   ?scope=everyone  the tombstone. Replaces the body for both sides.
//                    **Your own messages only.**
//
// ⚠️ This used to be one behaviour: a tombstone that EITHER participant could
// apply to ANY message, including the other person's. The comment called that
// "Telegram / WhatsApp style", and neither of those lets you delete someone
// else's message for everyone - the handler simply had no `senderId` check,
// while `PATCH` a few lines above does. So anyone could erase what the other
// person had said, in a private thread, with no trace beyond a tombstone.
//
// The delete stays SOFT either way: the row survives so the thread keeps its
// shape and a reported message is still there to look at afterwards.
export async function DELETE(req: Request, props: Ctx) {
  const params = await props.params;
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!isCuid(params.id) || !isCuid(params.messageId)) return fail("Invalid id.", 400);

    const { success } = await rateLimit("dm", me.id);
    if (!success) return fail("You're doing that too fast. Take a breath.", 429);

    // Defaults to the narrower, unprivileged action. An old client that sends
    // no scope removes the message for itself rather than for both sides -
    // which is the safe direction for a default to fail in.
    const scope = new URL(req.url).searchParams.get("scope") === "everyone" ? "everyone" : "me";

    const msg = await loadMine(params.id, params.messageId, me.id);
    if (!msg || msg.status !== "visible") return fail("Message not found.", 404);

    if (scope === "me") {
      const iAmUserA = msg.conversation.userAId === me.id;
      await prisma.directMessage.update({
        where: { id: msg.id },
        data: iAmUserA ? { hiddenByA: true } : { hiddenByB: true },
      });
      // Deliberately no broadcast and no `lastBody` change: for the other
      // participant nothing has happened, and their inbox preview is still
      // accurate. Telling them would leak that I hid something.
      return ok({ ok: true, scope });
    }

    if (msg.senderId !== me.id) {
      return fail("You can only delete your own messages for everyone.", 403);
    }

    await prisma.directMessage.update({
      where: { id: msg.id },
      // Unpinned as well: a pinned banner pointing at a deleted message is a
      // dead end the reader cannot clear themselves.
      data: { status: "deleted", pinnedAt: null },
    });

    // Refresh the inbox preview only if this actually WAS the newest message.
    //
    // ⚠️ The old guard was `lastSenderId === msg.senderId`, i.e. "was the
    // deleted message's sender also the last sender" - which is a different
    // question. Send m1 then m2, delete m1, and the preview became "Message
    // deleted" while m2 was still sitting there as the newest message.
    // Recomputing from the newest surviving row cannot get that wrong.
    const newest = await prisma.directMessage
      .findFirst({
        where: { conversationId: msg.conversationId },
        orderBy: { createdAt: "desc" },
        select: { id: true, body: true, status: true, senderId: true },
      })
      .catch(() => null);
    if (newest) {
      await prisma.conversation
        .update({
          where: { id: msg.conversationId },
          data: {
            lastBody: newest.status === "deleted" ? "Message deleted" : snippet(newest.body),
            lastSenderId: newest.senderId,
          },
        })
        .catch(() => null);
    }

    await broadcastEvent(userChannel(otherId(msg.conversation, me.id)), "dm_message", {
      conversationId: msg.conversationId,
    });
    return ok({ ok: true, scope });
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
