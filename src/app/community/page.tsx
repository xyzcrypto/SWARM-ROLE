import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { CHAT_PAGE_SIZE, CHAT_MESSAGE_SELECT, toChatPayload } from "@/lib/chat";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
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
  const initialMessages = page.reverse().map(toChatPayload);

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <div className="mesh" />
        <div className="relative mx-auto flex max-w-3xl flex-col px-4 pb-10 sm:px-6 lg:px-8">
          <div className="mb-6 text-center">
            <span className="eyebrow eyebrow-glass text-gold-200">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
              <span className="mono text-[11px] uppercase tracking-[0.18em]">Community</span>
            </span>
            <h1 className="mt-2 font-display text-3xl font-bold text-zinc-50 sm:text-4xl">
              The <span className="text-gold-gradient">XYZ Lounge</span>
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Markets, alpha, airdrops &amp; Web3 - live with the community.
            </p>
          </div>

          <ChatClient
            initialMessages={initialMessages}
            initialHasMore={hasMore}
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
      </main>
      <Footer />
    </>
  );
}
