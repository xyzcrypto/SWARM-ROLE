import { Suspense } from "react";
import { NOT_TRASHED } from "@modules/research/lib/post-visibility";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { ResearchGrid } from "@/components/ResearchGrid";
import { QuickPublish } from "@modules/research/components/QuickPublish";
import { ResearchHeroStats } from "@modules/research/components/ResearchHeroStats";
import { FeaturedResearchSection } from "@modules/research/components/FeaturedResearchSection";
import type { PostCardData } from "@modules/community/components/PostCard";
import { prisma } from "@/lib/prisma";
import { readingTime } from "@/lib/utils";
import { POST_CARD_SELECT } from "@/lib/post-select";
import { PageBackground } from "@/components/PageBackground";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  title: "Web3 Research Hub",
  description:
    "Institutional Web3 research, deep dives, tokenomics, protocol teardowns and on-chain intelligence from XYZ Crypto.",
  path: "/research",
});

export const revalidate = 1800;

const PAGE_SIZE = 12;

export default async function ResearchPage() {
  const [rawPosts, total, rawCategoryGroup, premiumCount] = await Promise.all([
    prisma.post
      .findMany({
        where: { published: true, ...NOT_TRASHED },
        orderBy: { createdAt: "desc" },
        select: POST_CARD_SELECT,
        take: PAGE_SIZE,
      })
      .catch(() => []),
    prisma.post.count({ where: { published: true, ...NOT_TRASHED } }).catch(() => 0),
    prisma.post
      .groupBy({
        by: ["category"],
        where: { published: true, ...NOT_TRASHED },
        _count: { id: true },
      })
      .catch(() => []),
    prisma.post
      .count({ where: { published: true, premium: true, ...NOT_TRASHED } })
      .catch(() => 0),
  ]);

  // Aggregate category counts for toolbar filter chips
  const categoryCounts: Record<string, number> = {
    All: total,
    Premium: premiumCount,
  };
  for (const g of rawCategoryGroup) {
    categoryCounts[g.category] = g._count.id;
  }

  // Never ship article bodies in the list payload (premium must never leak;
  // free bodies just bloat the RSC payload). Cards get a precomputed read time.
  const posts = rawPosts.map(({ content, createdAt, updatedAt, ...p }) => ({
    ...p,
    content: "",
    readMinutes: readingTime(content),
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt,
    updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : updatedAt,
  }));

  // Seamless fallback to 12 curated institutional demo reports if DB is empty/paused
  let displayPosts: PostCardData[] = posts;
  let displayTotal = total;
  let displayCategoryCounts = categoryCounts;
  let displayPremiumCount = premiumCount;

  if (displayPosts.length === 0) {
    const { DEMO_RESEARCH_POSTS } = await import("@modules/research/lib/demo-posts");
    displayPosts = DEMO_RESEARCH_POSTS;
    displayTotal = DEMO_RESEARCH_POSTS.length;
    displayPremiumCount = DEMO_RESEARCH_POSTS.filter((p) => p.premium).length;
    displayCategoryCounts = {
      All: DEMO_RESEARCH_POSTS.length,
      Research: DEMO_RESEARCH_POSTS.filter((p) => p.category === "Research").length,
      Article: DEMO_RESEARCH_POSTS.filter((p) => p.category === "Article").length,
      Post: DEMO_RESEARCH_POSTS.filter((p) => p.category === "Post").length,
      Premium: displayPremiumCount,
    };
  }

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Research", path: "/research" }])} />
      <Navbar />
      <main className="relative min-h-screen pt-20 sm:pt-24 bg-[#e9edf4] dark:bg-[#0c0e14] text-zinc-900 dark:text-zinc-100 selection:bg-amber-500/25 overflow-x-clip">
        <PageBackground />
        {/* Soft Neumorphic Studio Lighting: Directional Top-Left Soft Ambience */}
        <div aria-hidden className="pointer-events-none absolute -left-40 top-0 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-amber-400/[0.07] via-gold-500/[0.03] to-transparent blur-[140px]" />
        <div aria-hidden className="pointer-events-none absolute right-0 top-1/3 h-[500px] w-[500px] rounded-full bg-gradient-to-bl from-indigo-500/[0.05] via-purple-500/[0.02] to-transparent blur-[140px]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          {/* 1. Featured Research Section (Curated Cards Grid moved up) */}
          <FeaturedResearchSection posts={displayPosts} />

          {/* Quick Publish for Admins */}
          <div className="my-6">
            <QuickPublish />
          </div>

          {/* 2. Complete Research Library & Discovery Toolbar */}
          <div id="research-library" className="mt-8 pt-4">
            <Suspense fallback={null}>
              <ResearchGrid
                initial={displayPosts}
                total={displayTotal}
                pageSize={PAGE_SIZE}
                categoryCounts={displayCategoryCounts}
                hideHeroFeatured={true}
              />
            </Suspense>
          </div>

          {/* 3. Value Props / Highlights Strip (Moved to very bottom as requested) */}
          <div className="mt-14 sm:mt-18 pt-6">
            <ResearchHeroStats totalReports={displayTotal} premiumCount={displayPremiumCount} />
          </div>
        </div>
      </main>
    </>
  );
}
