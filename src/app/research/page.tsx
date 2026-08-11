import { Suspense } from "react";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { ResearchGrid } from "@/components/ResearchGrid";
import { prisma } from "@/lib/prisma";
import { readingTime } from "@/lib/utils";
import { POST_CARD_SELECT } from "@/lib/post-select";
import { PageHeader } from "@/components/PageHeader";
import { PageBackground } from "@/components/PageBackground";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  title: "Research Hub",
  description:
    "Web3 research, articles and posts from XYZ Crypto, on-chain analysis, market intelligence and education.",
  path: "/research",
});

// Cached; revalidated on demand when admin publishes/deletes (research routes).
export const revalidate = 300;

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


  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Research", path: "/research" }])} />
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <PageBackground />
        <div className="relative mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <PageHeader
            eyebrow="Knowledge Hub"
            title={<>Web3 <span className="text-shine">Research & Insights</span></>}
            subtitle="Deep dives, market intelligence and educational content, written to keep you ahead in the on-chain economy."
          />

          <div className="mt-12">
            {/* useSearchParams() inside ResearchGrid needs a Suspense boundary, or the
                whole page opts out of static rendering - which would undo this
                route's ISR window. */}
            <Suspense fallback={null}>
              <ResearchGrid initial={rawPosts} total={total} pageSize={PAGE_SIZE} />
            </Suspense>
          </div>
        </div>
      </main>
    </>
  );
}
