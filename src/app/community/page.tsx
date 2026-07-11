import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { CHAT_PAGE_SIZE, CHAT_MESSAGE_SELECT, toChatPayload } from "@/lib/chat";
import { Navbar } from "@/components/Navbar";
import { ChatClient } from "@/components/ChatClient";

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

  // Initial history (oldest-first for rendering); resilient to missing table
  // pre-migration - page renders with an empty room instead of crashing.
  const rows = await prisma.chatMessage
    .findMany({
      where: { status: "visible" },
      orderBy: { createdAt: "desc" },
      take: CHAT_PAGE_SIZE + 1,
      select: CHAT_MESSAGE_SELECT,
    })
    .catch(() => []);

  const hasMore = rows.length > CHAT_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, CHAT_PAGE_SIZE) : rows;
  let initialMessages = page.reverse().map(toChatPayload);

  // Latest pinned message for the banner (resilient pre-migration).
  const pinnedRow = await prisma.chatMessage
    .findFirst({
      where: { status: "visible", pinnedAt: { not: null } },
      orderBy: { pinnedAt: "desc" },
      select: CHAT_MESSAGE_SELECT,
    })
    .catch(() => null);
  let initialPinned = pinnedRow ? toChatPayload(pinnedRow) : null;

  // Stamp the viewer's own poll votes (myVote) for initial render.
  if (me?.id) {
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
          <div className="mb-2 flex shrink-0 items-center justify-center sm:mb-3">
            <span className="eyebrow eyebrow-glass text-gold-200">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400/80" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-400" />
              </span>
              <span className="mono text-shine text-[11px] uppercase tracking-[0.18em]">The XYZ Lounge</span>
            </span>
          </div>

          <div className="min-h-0 flex-1">
            <ChatClient
              initialMessages={initialMessages}
              initialHasMore={hasMore}
              initialPinned={initialPinned}
              me={
                me
                  ? {
                      id: me.id as string,
                      isAdmin: me.role === "ADMIN",
                      name: (me.name as string | null) ?? "Member",
                      image: (me.image as string | null) ?? null,
                      username: (me.username as string | null) ?? null,
                    }
                  : null
              }
              realtime={{
                url: env.NEXT_PUBLIC_SUPABASE_URL,
                anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
              }}
            />
          </div>
        </div>
      </main>
    </>
  );
}
