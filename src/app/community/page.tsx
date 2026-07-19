import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { env, gifEnabled } from "@/lib/env";
import { CHAT_MESSAGE_SELECT, toChatPayload, getCommunityPreview } from "@/lib/chat";
import { Navbar } from "@/components/Navbar";
import { ChatClient } from "@/components/ChatClient";
import { CommunityPreview } from "@/components/CommunityPreview";

export const metadata: Metadata = {
  title: "Community Chat",
  description:
    "The XYZ Crypto community lounge - talk markets, alpha, airdrops and Web3 live with other members.",
  alternates: { canonical: "/community" },
};
export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const session = await getServerSession(authOptions);
  const me = session?.user as any;

  // Anonymous visitors get a read-only preview (CommunityPreview) instead of
  // the full live room: no realtime WebSocket connection, no composer, and
  // the message list comes from a short-TTL shared cache (getCommunityPreview)
  // instead of a fresh Postgres round trip on every single anonymous page
  // view - crawlers and first-time visitors previously paid the same DB +
  // realtime cost as an actual logged-in member.
  if (!me?.id) {
    const { messages, pinned } = await getCommunityPreview();
    return (
      <>
        <Navbar />
        <main className="relative flex h-[100svh] flex-col overflow-hidden pt-[4.75rem] sm:pt-20">
          <div className="mesh" />
          <div className="relative mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-2 pb-2 pt-2 sm:px-6 sm:pb-4 sm:pt-3 lg:px-8">
            <div className="mb-2 flex shrink-0 items-center justify-center gap-2 sm:mb-3">
              <span className="eyebrow eyebrow-glass text-gold-200">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400/80" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-400" />
                </span>
                <span className="mono text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                  Markets · Alpha · Airdrops — live
                </span>
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <CommunityPreview messages={messages} pinned={pinned} now={Date.now()} />
            </div>
          </div>
        </main>
      </>
    );
  }

  // Initial history + the pinned banner - run in parallel (independent queries)
  // so the page opens faster. Both resilient to a missing table pre-migration:
  // the room renders empty instead of crashing.
  // Render a smaller initial screenful for a fast first open; "Load older"
  // pages the rest via /api/chat/messages (CHAT_PAGE_SIZE).
  const INITIAL_COUNT = 30;
  const [rows, pinnedRow] = await Promise.all([
    prisma.chatMessage
      .findMany({
        where: { status: "visible" },
        orderBy: { createdAt: "desc" },
        take: INITIAL_COUNT + 1,
        select: CHAT_MESSAGE_SELECT,
      })
      .catch(() => []),
    prisma.chatMessage
      .findFirst({
        where: { status: "visible", pinnedAt: { not: null } },
        orderBy: { pinnedAt: "desc" },
        select: CHAT_MESSAGE_SELECT,
      })
      .catch(() => null),
  ]);

  const hasMore = rows.length > INITIAL_COUNT;
  const page = hasMore ? rows.slice(0, INITIAL_COUNT) : rows;
  let initialMessages = page.reverse().map(toChatPayload);

  let initialPinned = pinnedRow ? toChatPayload(pinnedRow) : null;

  // Stamp the viewer's own poll votes (myVote) for initial render.
  {
    const pollIds = [
      ...initialMessages.filter((m) => m.poll).map((m) => m.poll!.id),
      ...(initialPinned?.poll ? [initialPinned.poll.id] : []),
    ];
    if (pollIds.length) {
      const votes = await prisma.chatPollVote
        .findMany({
          where: { userId: me.id as string, pollId: { in: pollIds } },
          select: { pollId: true, optionId: true },
        })
        .catch(() => []);
      const mine = new Map(votes.map((v) => [v.pollId, v.optionId]));
      initialMessages = initialMessages.map((m) =>
        m.poll ? { ...m, poll: { ...m.poll, myVote: mine.get(m.poll.id) ?? null } } : m
      );
      if (initialPinned?.poll) {
        initialPinned = {
          ...initialPinned,
          poll: { ...initialPinned.poll, myVote: mine.get(initialPinned.poll.id) ?? null },
        };
      }
    }
  }

  return (
    <>
      <Navbar />
      {/* App-style chat: the whole screen is one fixed frame - the page itself
          never scrolls, only the message list inside ChatClient does. */}
      <main className="relative flex h-[100svh] flex-col overflow-hidden pt-[4.75rem] sm:pt-20">
        <div className="mesh" />
        <div className="relative mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-2 pb-2 pt-2 sm:px-6 sm:pb-4 sm:pt-3 lg:px-8">
          <div className="mb-2 flex shrink-0 items-center justify-center gap-2 sm:mb-3">
            <span className="eyebrow eyebrow-glass text-gold-200">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400/80" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-400" />
              </span>
              <span className="mono text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                Markets · Alpha · Airdrops — live
              </span>
            </span>
          </div>

          <div className="min-h-0 flex-1">
            <ChatClient
              initialMessages={initialMessages}
              initialHasMore={hasMore}
              initialPinned={initialPinned}
              me={{
                id: me.id as string,
                isAdmin: me.role === "ADMIN",
                name: (me.name as string | null) ?? "Member",
                image: (me.image as string | null) ?? null,
                username: (me.username as string | null) ?? null,
              }}
              realtime={{
                url: env.NEXT_PUBLIC_SUPABASE_URL,
                anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
              }}
              gifEnabled={gifEnabled}
            />
          </div>
        </div>
      </main>
    </>
  );
}
