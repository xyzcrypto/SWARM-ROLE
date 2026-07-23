import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { otherOf, snippet, DM_MAX_LEN, DM_USER_SELECT } from "@/lib/dm";
import { broadcastEvent, userChannel } from "@/lib/realtime";
import { sendPush, pushEnabled } from "@/lib/push";
import { chatMediaUrl } from "@/lib/chat-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Load a conversation and confirm the caller is one of its two participants.
async function loadMine(id: string, myId: string) {
  const conv = await prisma.conversation.findUnique({
    where: { id },
    include: { userA: { select: DM_USER_SELECT }, userB: { select: DM_USER_SELECT } },
  });
  if (!conv || (conv.userAId !== myId && conv.userBId !== myId)) return null;
  return conv;
}

// GET /api/dm/[id] — the thread (oldest→newest) + the other participant. Also
// marks the thread read for me.
export async function GET(_req: Request, props: Ctx) {
  const params = await props.params;
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!isCuid(params.id)) return fail("Invalid conversation.", 400);

    const conv = await loadMine(params.id, me.id);
    if (!conv) return fail("Conversation not found.", 404);

    const rows = await prisma.directMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: { id: true, body: true, createdAt: true, senderId: true },
    });

    // Mark read for whichever side I am (best-effort; never block the read).
    const iAmA = conv.userAId === me.id;
    await prisma.conversation
      .update({ where: { id: conv.id }, data: iAmA ? { readAAt: new Date() } : { readBAt: new Date() } })
      .catch(() => null);

    const { other } = otherOf(conv, me.id);
    const messages = rows.map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt, mine: m.senderId === me.id }));

    return ok({
      messages,
      other: other ? { id: other.id, name: other.name || other.username || "Member", username: other.username, image: other.image } : null,
    });
  } catch (err) {
    return handleError(err, "dm:thread");
  }
}

const sendSchema = z.object({ body: z.string().trim().min(1).max(DM_MAX_LEN) });

// POST /api/dm/[id] — send a message into this conversation.
export async function POST(req: Request, props: Ctx) {
  const params = await props.params;
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!isCuid(params.id)) return fail("Invalid conversation.", 400);

    const { success } = await rateLimit("dm", me.id);
    if (!success) return fail("You're sending messages too fast. Take a breath.", 429);

    const conv = await loadMine(params.id, me.id);
    if (!conv) return fail("Conversation not found.", 404);

    const parsed = sendSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid message.", 400);
    const body = parsed.data.body;

    const iAmA = conv.userAId === me.id;
    const now = new Date();
    const created = await prisma.directMessage.create({
      data: { conversationId: conv.id, senderId: me.id, body },
      select: { id: true, body: true, createdAt: true },
    });

    // Bump the conversation for inbox ordering + preview, and mark it read for
    // me (I've obviously seen my own message).
    await prisma.conversation
      .update({
        where: { id: conv.id },
        data: {
          lastMessageAt: now,
          lastBody: snippet(body),
          lastSenderId: me.id,
          ...(iAmA ? { readAAt: now } : { readBAt: now }),
        },
      })
      .catch(() => null);

    // Push the new message live to the recipient's per-user channel. Fire-and-
    // forget + recipient-only: the sender already has the row from this response,
    // so there's no self-echo to dedupe. No-op when realtime is unconfigured
    // (the recipient's thread/inbox still pick it up via the poll fallback).
    const recipientId = iAmA ? conv.userBId : conv.userAId;
    await broadcastEvent(userChannel(recipientId), "dm_message", {
      conversationId: conv.id,
      message: { id: created.id, body: created.body, createdAt: created.createdAt, senderId: me.id },
    });

    // Fire-and-forget external push to the recipient's devices (private DM alert).
    if (pushEnabled) {
      const meName = (me as { name?: string | null }).name || "New message";
      const preview = chatMediaUrl(body) ? "📷 Photo" : snippet(body);
      void (async () => {
        const subs = await prisma.pushSubscription.findMany({ where: { userId: recipientId }, select: { endpoint: true, p256dh: true, auth: true } }).catch(() => []);
        if (!subs.length) return;
        const payload = { title: `💬 ${meName}`, body: preview, url: `/messages?c=${conv.id}`, tag: `dm-${conv.id}` };
        const results = await Promise.all(subs.map((s) => sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload)));
        const gone = subs.filter((_, i) => results[i] === "gone").map((s) => s.endpoint);
        if (gone.length) await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: gone } } }).catch(() => {});
      })();
    }

    return ok({ message: { id: created.id, body: created.body, createdAt: created.createdAt, mine: true } }, 201);
  } catch (err) {
    return handleError(err, "dm:send");
  }
}
