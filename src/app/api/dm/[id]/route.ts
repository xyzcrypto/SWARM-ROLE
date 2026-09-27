import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { otherOf, snippet, DM_MAX_LEN, DM_USER_SELECT } from "@/lib/dm";
import { broadcastEvent, userChannel } from "@/lib/realtime";
import { notifyMentions } from "@modules/notifications/lib/notifications";
import { sendPush, pushEnabled } from "@/lib/push";
import { chatMediaUrl } from "@/lib/chat-media";
import { canSendInThread, isBlockedEitherWay } from "@/lib/dm-gate";
import { toDmReactions, type DmReactions } from "@modules/messages/lib/dm-reactions";

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
    // "Delete for me" is filtered HERE, on the server, per requester - the row
    // stays and the other side still sees it. Doing this client-side would ship
    // the body to a reader who asked never to see it again, which is the same
    // mistake as hiding a `status: "deleted"` body in CSS.
    const iAmUserA = conv.userAId === me.id;
    const notHiddenForMe = iAmUserA ? { hiddenByA: false } : { hiddenByB: false };

    const [rows, pinnedRow] = await Promise.all([
      prisma.directMessage.findMany({
        where: { conversationId: conv.id, ...notHiddenForMe },
        orderBy: { createdAt: "asc" },
        take: 200,
        select: {
          id: true, body: true, createdAt: true, senderId: true, status: true,
          editedAt: true, pinnedAt: true, forwarded: true,
          // Only what a quote line needs. A deleted parent still resolves, so
          // the preview can say "message deleted" instead of vanishing.
          replyTo: { select: { id: true, body: true, senderId: true, status: true } },
        },
      }),
      prisma.directMessage.findFirst({
        // Same filter: a banner pointing at a message I removed for myself is a
        // dead end I cannot clear.
        where: { conversationId: conv.id, status: "visible", pinnedAt: { not: null }, ...notHiddenForMe },
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

    // Reactions in their OWN query, and allowed to fail. Preview deploys share
    // the production database but never push the schema (scripts/db-push.mjs
    // is production-only), so until the next production deploy these columns
    // do not exist - and selecting them in the query above would take every
    // DM thread down with a P2022, not just the reactions. Missing columns
    // mean "no reactions yet", which is exactly what they are.
    const reactionsById = new Map<string, DmReactions>();
    if (rows.length) {
      const reacted = await prisma.directMessage
        .findMany({
          where: {
            id: { in: rows.map((r) => r.id) },
            OR: [{ reactionA: { not: null } }, { reactionB: { not: null } }],
          },
          select: { id: true, reactionA: true, reactionB: true },
        })
        .catch(() => []);
      for (const r of reacted) reactionsById.set(r.id, toDmReactions(r, iAmUserA));
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
      forwarded: m.forwarded,
      reactions: m.status === "deleted" ? null : reactionsById.get(m.id) ?? null,
      // The quote line. A deleted parent still resolves, with its body stripped
      // for the same reason the message itself is - so the preview can say
      // "message deleted" rather than silently disappearing and making the
      // reply look like it answers nothing.
      replyTo: m.replyTo
        ? {
            id: m.replyTo.id,
            body: m.replyTo.status === "deleted" ? "" : m.replyTo.body,
            deleted: m.replyTo.status === "deleted",
            mine: m.replyTo.senderId === me.id,
          }
        : null,
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
      // Whether this thread is closed, and whether it was me who closed it -
      // "you blocked them" and "you cannot message them" need different words.
      blocked: await isBlockedEitherWay(me.id, iAmA ? conv.userBId : conv.userAId),
      blockedByMe: !!(await prisma.block
        .findUnique({
          where: { blockerId_blockedId: { blockerId: me.id, blockedId: iAmA ? conv.userBId : conv.userAId } },
          select: { id: true },
        })
        .catch(() => null)),
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

const sendSchema = z.object({
  body: z.string().trim().min(1).max(DM_MAX_LEN),
  replyToId: z.string().optional(),
  /** Marks the message as forwarded. A flag, never a link to the original. */
  forwarded: z.boolean().optional(),
});

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
    // A block ends an open thread in both directions. Deliberately checked here
    // and not only in the UI: the composer being hidden is a courtesy, this is
    // the rule.
    const gate = await canSendInThread(me.id, iAmA ? conv.userBId : conv.userAId);
    if (!gate.ok) return fail(gate.reason, 403);
    // ⚠️ The reply target must live in THIS conversation. The foreign key alone
    // would happily accept an id from someone else's thread, and the quoted
    // preview would then render private text to a person with no right to it.
    // Scoping the lookup by conversationId is the whole guard - an id that does
    // not match is dropped rather than rejected, so a stale reply target just
    // sends as a normal message.
    let replyToId: string | null = null;
    if (parsed.data.replyToId) {
      const parent = await prisma.directMessage.findFirst({
        where: { id: parsed.data.replyToId, conversationId: conv.id, status: "visible" },
        select: { id: true },
      });
      replyToId = parent?.id ?? null;
    }

    const now = new Date();
    const created = await prisma.directMessage.create({
      data: {
        conversationId: conv.id,
        senderId: me.id,
        body,
        replyToId,
        forwarded: parsed.data.forwarded === true,
      },
      select: {
        id: true, body: true, createdAt: true, forwarded: true,
        replyTo: { select: { id: true, body: true, senderId: true, status: true } },
      },
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
          // Mark read for me + un-hide for the recipient (if they removed the
          // conversation, a new message should resurface it for them).
          ...(iAmA ? { readAAt: now, hiddenByB: false } : { readBAt: now, hiddenByA: false }),
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

    // Tell the other participant if they were @mentioned.
    //
    // `restrictToUserIds` is doing real work here, not being cautious: a DM has
    // exactly two participants, and without it `@someone_else` in a private
    // thread would notify a third party that they were mentioned somewhere they
    // cannot open - which leaks that the conversation exists at all.
    void notifyMentions({
      body,
      authorId: me.id,
      authorName: (me as { name?: string | null }).name || "Someone",
      context: "dm",
      href: `/messages?c=${conv.id}`,
      restrictToUserIds: [recipientId],
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

    // ⚠️ The reply quote and the forwarded flag go back too. They used to be
    // left out, and the client swaps its optimistic row for exactly this
    // object - so a reply lost its quote the moment the server answered and
    // only got it back on the next full reload. That was the "tag karne pe
    // direct tag nahi ho raha, page refresh ke baad hota hai" report.
    return ok(
      {
        message: {
          id: created.id,
          body: created.body,
          createdAt: created.createdAt,
          mine: true,
          forwarded: created.forwarded,
          replyTo: created.replyTo
            ? {
                id: created.replyTo.id,
                body: created.replyTo.status === "deleted" ? "" : created.replyTo.body,
                deleted: created.replyTo.status === "deleted",
                mine: created.replyTo.senderId === me.id,
              }
            : null,
        },
      },
      201
    );
  } catch (err) {
    return handleError(err, "dm:send");
  }
}
