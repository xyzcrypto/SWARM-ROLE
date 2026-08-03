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

    // Deleted messages are still returned, as tombstones. Removing the row
    // from the list would make the thread jump under the reader's cursor and
    // would quietly rewrite a conversation they had already read; every
    // messenger worth copying leaves "this message was deleted" in place.
    const [rows, pinnedRow] = await Promise.all([
      prisma.directMessage.findMany({
        where: { conversationId: conv.id },
        orderBy: { createdAt: "asc" },
        take: 200,
        select: { id: true, body: true, createdAt: true, senderId: true, status: true, editedAt: true, pinnedAt: true },
      }),
      prisma.directMessage.findFirst({
        where: { conversationId: conv.id, status: "visible", pinnedAt: { not: null } },
        orderBy: { pinnedAt: "desc" },
        select: { id: true, body: true, createdAt: true, senderId: true },
      }),
    ]);

    // Mark read for whichever side I am (best-effort; never block the read).
    const iAmA = conv.userAId === me.id;
    const myPrevRead = iAmA ? conv.readAAt : conv.readBAt;
    const readAt = new Date();
    await prisma.conversation
      .update({ where: { id: conv.id }, data: iAmA ? { readAAt: readAt } : { readBAt: readAt } })
      .catch(() => null);

    // Tell the OTHER side their message has been read, so their ticks turn
    // without waiting for a poll.
    //
    // Only when the read actually advanced past something of theirs. This GET
    // also runs on every silent refetch (the thread reloads on each `dm_message`
    // ping), and broadcasting on all of those would be a loop: my refetch pings
    // you, your refetch pings me.
    const theyWroteLast = conv.lastSenderId && conv.lastSenderId !== me.id;
    const wasUnread = theyWroteLast && (!myPrevRead || myPrevRead < conv.lastMessageAt);
    if (wasUnread) {
      // Same rule as the `dm_message` ping below: this channel is public, so
      // nothing goes on the wire but the conversation id and a timestamp. That
      // is strictly less than the existing ping already discloses, and it saves
      // the sender a full 200-message thread refetch just to learn one date.
      const otherId = iAmA ? conv.userBId : conv.userAId;
      await broadcastEvent(userChannel(otherId), "dm_read", {
        conversationId: conv.id,
        at: readAt.toISOString(),
      });
    }

    const { other } = otherOf(conv, me.id);
    const messages = rows.map((m) => ({
      id: m.id,
      // A deleted message must not ship its text. The tombstone is the whole
      // point; sending the body and hiding it in CSS would mean "deleted" only
      // held for people who do not open devtools.
      body: m.status === "deleted" ? "" : m.body,
      createdAt: m.createdAt,
      mine: m.senderId === me.id,
      deleted: m.status === "deleted",
      editedAt: m.editedAt,
      pinned: !!m.pinnedAt,
    }));

    return ok({
      messages,
      // When the other side last opened this thread. Anything I sent before it
      // has been read - that is the whole read-receipt calculation, and it
      // needs no new column and no per-message write.
      otherReadAt: (iAmA ? conv.readBAt : conv.readAAt) ?? null,
      pinned: pinnedRow
        ? { id: pinnedRow.id, body: pinnedRow.body, mine: pinnedRow.senderId === me.id }
        : null,
      other: other
        ? {
            id: other.id,
            name: other.name || other.username || "Member",
            username: other.username,
            image: other.image,
            // May be absent on a database that has not had 31_last_seen pushed
            // yet; the client renders nothing rather than guessing.
            lastSeenAt: (other as { lastSeenAt?: Date | null }).lastSeenAt ?? null,
          }
        : null,
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

    // Push a live "something changed" ping to the recipient's per-user channel.
    // Deliberately carries NO message content: Supabase Realtime broadcast on
    // this channel is public (unauthenticated `private: false`, anon key), and
    // the recipient's user id is discoverable (public profile page, DM search),
    // so anything put on the wire here is readable by anyone who guesses the
    // channel name - not just the intended recipient. The client already
    // refetches the thread through the participant-checked GET above on every
    // ping, so a bare ping is all that's needed (matches the CH_NOTIFY pattern).
    const recipientId = iAmA ? conv.userBId : conv.userAId;
    await broadcastEvent(userChannel(recipientId), "dm_message", { conversationId: conv.id });

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
