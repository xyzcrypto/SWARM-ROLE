import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ResearchGrid } from "@/components/ResearchGrid";
import { prisma } from "@/lib/prisma";
import { readingTime } from "@/lib/utils";
import { POST_CARD_SELECT } from "@/lib/post-select";
import { PageHeader } from "@/components/PageHeader";

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
        select: POST_CARD_SELECT,
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
          <PageHeader
            eyebrow="Knowledge Hub"
            title={<>Web3 <span className="text-shine">Research & Insights</span></>}
            subtitle="Deep dives, market intelligence and educational content, written to keep you ahead in the on-chain economy."
          />

          <div className="mt-12">
            <ResearchGrid initial={posts} total={total} pageSize={PAGE_SIZE} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
