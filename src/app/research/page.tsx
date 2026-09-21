import { Suspense } from "react";
import { NOT_TRASHED } from "@modules/research/lib/post-visibility";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { ResearchGrid } from "@/components/ResearchGrid";
import { QuickPublish } from "@modules/research/components/QuickPublish";
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
//
// ⚠️ 300s -> 1800s. The on-demand path is the real freshness guarantee here:
// `POST /api/research` and `PATCH|DELETE /api/research/[id]` both call
// `revalidatePath("/research")`, so a new or removed article shows up at once.
// The timer was doing nothing except rebuilding an article list that changes a
// few times a week, 288 times a day - **414 ISR Writes against 177 Reads**, the
// second-worst ratio on the site.
export const revalidate = 1800;

const PAGE_SIZE = 12;

export default async function ResearchPage() {
  const [rawPosts, total] = await Promise.all([
    prisma.post
      .findMany({
        /**
         * ⚠️ `NOT_TRASHED` belongs on BOTH queries, and its absence here was a
         * live bug: a deleted post stayed on this page.
         *
         * The `count` below already filtered it and this one did not, so the
         * two disagreed - the list rendered trashed posts while the total
         * excluded them. For a premium post that meant deleting it left a
         * locked card sitting on the index, which reads as "delete did not
         * work" and is indistinguishable from it.
         *
         * Every other read of this table - the detail page, the OG image, the
         * API - already had the filter. This one query was the hole, which is
         * exactly why it survived: the feature looked correct everywhere a test
         * or a reviewer would think to look.
         */
        where: { published: true, ...NOT_TRASHED },
        orderBy: { createdAt: "desc" },
        select: POST_CARD_SELECT,
        take: PAGE_SIZE,
      })
      .catch(() => []),
    prisma.post.count({ where: { published: true, ...NOT_TRASHED } }).catch(() => 0),
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

          {/* Publish from here rather than from the dashboard. Renders nothing
              without `post:publish`; the route enforces the same permission
              independently, so this gate is a courtesy and never the boundary. */}
          <div className="mt-10">
            <QuickPublish />
          </div>

          <div className="mt-8">
            {/* useSearchParams() inside ResearchGrid needs a Suspense boundary, or the
                whole page opts out of static rendering - which would undo this
                route's ISR window. */}
            <Suspense fallback={null}>
              <ResearchGrid initial={posts} total={total} pageSize={PAGE_SIZE} />
            </Suspense>
          </div>
        </div>
      </main>
    </>
  );
}
