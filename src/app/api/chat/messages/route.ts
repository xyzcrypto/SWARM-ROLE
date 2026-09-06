import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { aiEnabled } from "@/lib/ai";
import { classifyToxic } from "@/lib/ai-tasks";
import {
  chatMessageSchema,
  broadcastChatEvent,
  toChatPayload,
  CHAT_MESSAGE_SELECT,
  CHAT_PAGE_SIZE,
} from "@/lib/chat";
import { dispatchChatPush } from "@/lib/chat-push";
import { notifyMentions } from "@modules/notifications/lib/notifications";

// GET /api/chat/messages[?cursor=<id>] - public chat history, newest page
// first; pass the oldest message id as cursor to page further back. Includes
// the requester's poll votes (myVote) and, on the first page, the latest
// pinned message for the banner.
export async function GET(req: Request) {
  try {
    const cursor = new URL(req.url).searchParams.get("cursor");
    if (cursor && !isCuid(cursor)) return fail("Invalid cursor.", 400);

    const me = await getSessionUser().catch(() => null);

    // History and the pinned banner are independent - neither reads the other's
    // result - but they used to be awaited one after the other, so opening the
    // room paid two full round trips to Mumbai back to back where one would do.
    // The /community *page* already gets this right (`Promise.all` in
    // src/app/community/page.tsx, commented "run in parallel (independent
    // queries)"); the API route serving the same two pieces of data did not.
    const [rows, pinnedRow] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { status: "visible" },
        orderBy: { createdAt: "desc" },
        take: CHAT_PAGE_SIZE + 1, // +1 → hasMore without a count query
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: CHAT_MESSAGE_SELECT,
      }),
      // First page only - the banner needs exactly one.
      cursor
        ? Promise.resolve(null)
        : prisma.chatMessage
            .findFirst({
              where: { status: "visible", pinnedAt: { not: null } },
              orderBy: { pinnedAt: "desc" },
              select: CHAT_MESSAGE_SELECT,
            })
            .catch(() => null),
    ]);

    const hasMore = rows.length > CHAT_PAGE_SIZE;
    const page = hasMore ? rows.slice(0, CHAT_PAGE_SIZE) : rows;
    // Oldest-first for rendering; cursor = oldest id of this page.
    let messages = page.reverse().map(toChatPayload);
    let pinned = pinnedRow ? toChatPayload(pinnedRow) : null;

    // Stamp the requester's own poll votes (never part of broadcasts).
    if (me) {
      const pollIds = [
        ...messages.filter((m) => m.poll).map((m) => m.poll!.id),
        ...(pinned?.poll ? [pinned.poll.id] : []),
      ];
      if (pollIds.length) {
        const votes = await prisma.chatPollVote
          .findMany({ where: { userId: me.id, pollId: { in: pollIds } }, select: { pollId: true, optionId: true } })
          .catch(() => []);
        const mine = new Map(votes.map((v) => [v.pollId, v.optionId]));
        messages = messages.map((m) =>
          m.poll ? { ...m, poll: { ...m.poll, myVote: mine.get(m.poll.id) ?? null } } : m
        );
        if (pinned?.poll) pinned = { ...pinned, poll: { ...pinned.poll, myVote: mine.get(pinned.poll.id) ?? null } };
      }
    }

    // Polled every 10s by every open /community tab as the realtime fallback.
    // For an anonymous requester (no poll votes to stamp) the response for a
    // given cursor is identical across all visitors, so it's safe to cache
    // publicly for a few seconds - matches the api/news/social recipe.
    // Logged-in responses stay live since myVote is genuinely per-viewer.
    //
    // ⚠️ s-maxage 8 -> 15, and the number has to clear CHAT_POLL_MS (10s), not
    // merely be "a few seconds". At 8s against a 10s poll the edge entry expired
    // roughly two seconds before every poll arrived, so **every anonymous poll
    // fell through to Postgres** - on the one page that gives signed-out
    // visitors a live read-only preview. That is Supabase egress bought for
    // traffic the CDN was already willing to serve, and egress is the metric
    // this project is closest to its quota on.
    //
    // 15s costs a signed-out viewer up to ~7 extra seconds of staleness on a
    // preview they cannot post into. Signed-in viewers are untouched: they stay
    // `private, no-store` and are driven by realtime, with this poll only as a
    // fallback. Same defect as `/api/news`, same rule - the window must be
    // longer than the poll that drives it, with margin.
    return NextResponse.json(
      { messages, hasMore, nextCursor: hasMore ? page[0]!.id : null, pinned },
      { headers: { "Cache-Control": me ? "private, no-store" : "public, s-maxage=15, stale-while-revalidate=60" } }
    );
  } catch (err) {
    return handleError(err, "chat:list");
  }
}

// POST /api/chat/messages - send a message (logged-in only, rate-limited).
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in to chat.", 401);

    const { success } = await rateLimit("chat", me.id);
    if (!success) return fail("You're sending messages too fast. Take a breath.", 429);

    const parsed = chatMessageSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid message", 400);
    }

    // Validate the reply target exists and is visible (ignore otherwise).
    let replyToId: string | null = null;
    if (parsed.data.replyToId) {
      const parent = await prisma.chatMessage.findUnique({
        where: { id: parsed.data.replyToId },
        select: { id: true, status: true },
      });
      if (parent && parent.status === "visible") replyToId = parent.id;
    }

    const created = await prisma.chatMessage.create({
      data: { body: parsed.data.body, userId: me.id, replyToId },
      select: CHAT_MESSAGE_SELECT,
    });

    const message = toChatPayload(created);

    // Fire-and-forget the realtime broadcast so the sender's response returns
    // immediately (no Supabase round-trip on the send path). The sender already
    // has the message from THIS response; other members get it via the broadcast
    // (or the 10s realtime poll fallback). Consistent with the push/moderation
    // fire-and-forget below.
    void broadcastChatEvent({ event: "new_message", payload: message }).catch(() => {});

    // Nudge subscribed members' phones when the lounge wakes up after a quiet
    // spell (gated on VAPID + anti-spam inside; never blocks send).
    void dispatchChatPush(created);

    // Tell anyone tagged in the message. Fire-and-forget for the same reason as
    // everything else on this path - a mention that fails to notify must never
    // take the message with it.
    //
    // This room has parsed, highlighted and autocompleted mentions since it was
    // built, and until now being tagged was something you found out by
    // scrolling back through the room.
    void notifyMentions({
      body: parsed.data.body,
      authorId: me.id,
      // From the message payload, not the session: `SessionUser` carries only
      // access metadata (id, role, membership, permissions), no display name.
      authorName: message.author.name || message.author.username || "Someone",
      context: "community",
      href: "/community",
    });

    // AI auto-moderation - FIRE-AND-FORGET so the send stays instant (never block
    // the composer on a classify call). The message is already created + broadcast;
    // this only decides whether to *hide* it a beat later via the existing path.
    // Best-effort + fail-open. No-op when AI is disabled.
    if (aiEnabled) {
      void classifyToxic(parsed.data.body)
        .then((toxic) =>
          toxic
            ? prisma.chatMessage
                .update({ where: { id: created.id }, data: { status: "hidden" } })
                .then(() => broadcastChatEvent({ event: "message_hidden", payload: { id: created.id } }))
            : null
        )
        .catch(() => null);
    }

    return ok({ message }, 201);
  } catch (err) {
    return handleError(err, "chat:create");
  }
}
