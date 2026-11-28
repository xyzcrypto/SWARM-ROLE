import Link from "next/link";
import { NOT_TRASHED } from "@modules/research/lib/post-visibility";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { rankPosts } from "@/lib/ai-ground";

// Server-rendered "related research" strip for pages that had no path into the
// research library at all - coin and protocol pages, which are the largest
// indexable surface on the site and, until now, linked nowhere.
//
// Ranking reuses `rankPosts` from the AI grounding helpers rather than
// inventing a second relevance rule: it is already a pure keyword-overlap
// ranker (title weighted over excerpt over body) and already unit-tested.
//
// Rendered on the SERVER on purpose. The whole point is a crawlable <a> in the
// HTML; a client-rendered list would be invisible to the thing this is for.

/**
 * Every published post, fetched once per request. The corpus is small (single
 * digits), so this is a trivial query - and `cache()` means two strips on one
 * page still cost one round trip.
 */
const allPublished = cache(async () => {
  return prisma.post
    .findMany({
      where: { published: true, ...NOT_TRASHED },
      select: { title: true, slug: true, excerpt: true, category: true },
      orderBy: { createdAt: "desc" },
      take: 60,
    })
    .catch(() => [] as { title: string; slug: string; excerpt: string; category: string }[]);
});

export async function RelatedResearch({
  query,
  heading = "Related research",
  limit = 3,
}: {
  /** What this page is about - a coin or protocol name. */
  query: string;
  heading?: string;
  limit?: number;
}) {
  const posts = await allPublished();
  if (!posts.length) return null;

  // rankPosts wants a GroundingPost shape; there is no body here and none is
  // needed - title and excerpt carry the signal for a page-level match.
  const ranked = rankPosts(
    posts.map((p) => ({ title: p.title, slug: p.slug, excerpt: p.excerpt, content: "" })),
    query
  ).slice(0, limit);

  if (!ranked.length) return null;

  return (
    <section className="mt-12">
      <h2 className="font-display text-lg font-semibold text-zinc-100">{heading}</h2>
      <ul className="mt-4 space-y-2">
        {ranked.map((p) => {
          const category = posts.find((x) => x.slug === p.slug)?.category;
          return (
            <li key={p.slug}>
              <Link
                href={`/research/${p.slug}`}
                className="group block rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 transition-colors hover:border-gold-500/30 hover:bg-white/[0.06]"
              >
                <span className="block text-[0.875rem] font-medium text-zinc-100 group-hover:text-gold-100">
                  {p.title}
                </span>
                <span className="mt-0.5 block truncate text-[0.75rem] text-zinc-500">
                  {category ? `${category} · ` : ""}
                  {p.excerpt}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        href="/academy/research"
        className="mono mt-3 inline-block text-[0.6875rem] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-gold-200"
      >
        All research →
      </Link>
    </section>
  );
}
