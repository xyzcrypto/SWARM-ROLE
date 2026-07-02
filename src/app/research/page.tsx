import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ResearchGrid } from "@/components/ResearchGrid";
import { prisma } from "@/lib/prisma";
import { readingTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Research Hub",
  description:
    "Web3 research, articles and posts from XYZ Crypto, on-chain analysis, market intelligence and education.",
};

// Cached; revalidated on demand when admin publishes/deletes (research routes).
export const revalidate = 120;

const PAGE_SIZE = 12;

export default async function ResearchPage() {
  const [rawPosts, total] = await Promise.all([
    prisma.post
      .findMany({
        where: { published: true },
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true } } },
        take: PAGE_SIZE,
      })
      .catch(() => []),
    prisma.post.count({ where: { published: true } }).catch(() => 0),
  ]);
  // Never ship article bodies in the list payload (premium must never leak;
  // free bodies just bloat the RSC payload). Cards get a precomputed read time.
  const posts = rawPosts.map(({ content, ...p }) => ({
    ...p,
    content: "",
    readMinutes: readingTime(content),
  }));

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <div className="mesh" />
        <div className="relative mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold-400">
              Knowledge Hub
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold text-zinc-50 sm:text-6xl">
              Web3 <span className="text-gold-gradient">Research & Insights</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-zinc-400">
              Deep dives, market intelligence and educational content, written
              to keep you ahead in the on-chain economy.
            </p>
          </div>

          <div className="mt-14">
            <ResearchGrid initial={posts} total={total} pageSize={PAGE_SIZE} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
