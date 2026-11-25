import { Suspense } from "react";
import { NOT_TRASHED } from "@modules/research/lib/post-visibility";
import { ResearchGrid } from "@/components/ResearchGrid";
import { QuickPublish } from "@modules/research/components/QuickPublish";
import { prisma } from "@/lib/prisma";
import { readingTime } from "@/lib/utils";
import { POST_CARD_SELECT } from "@/lib/post-select";
import { PageHeader } from "@/components/PageHeader";

// The research hub moved into the Academy (owner, 2026-11-25): it lives at
// /academy/research, and /research redirects there. Article pages keep their
// /research/<slug> URLs, so every shared link and search result still works.
export const RESEARCH_HUB = "/academy/research";

const PAGE_SIZE = 12;

/** The research hub (articles list + publish), rendered inside the Academy. */
export async function ResearchHub() {
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
    <div className="acad-research">
      <PageHeader
        eyebrow="Academy · Research"
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
  );
}
