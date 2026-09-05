import Link from "next/link";
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
 * Every published post, cached in-memory with a 60s TTL across server requests.
 * The corpus is small, and `cache()` + in-memory TTL means protocol/coin pages
 * do not hit the database on every page view.
 */
let cachedPosts: { title: string; slug: string; excerpt: string; category: string }[] | null = null;
let lastFetch = 0;
const CACHE_TTL_MS = 60_000;

const allPublished = cache(async () => {
  const now = Date.now();
  if (cachedPosts && now - lastFetch < CACHE_TTL_MS) {
    return cachedPosts;
  }
  const posts = await prisma.post
    .findMany({
      where: { published: true },
      select: { title: true, slug: true, excerpt: true, category: true },
      orderBy: { createdAt: "desc" },
      take: 60,
    })
    .catch(() => [] as { title: string; slug: string; excerpt: string; category: string }[]);
  cachedPosts = posts;
  lastFetch = now;
  return posts;
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

  const categoryMap = new Map(posts.map((x) => [x.slug, x.category]));

  return (
    <section className="mt-12">
      <h2 className="font-display text-lg font-semibold text-zinc-100">{heading}</h2>
      <ul className="mt-4 space-y-2">
        {ranked.map((p) => {
          const category = categoryMap.get(p.slug);
          return (
            <li key={p.slug}>
              <Link
                href={`/research/${p.slug}`}
                className="group block rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 transition-colors hover:border-gold-500/30 hover:bg-white/[0.06]"
              >
                <span className="block text-[14px] font-medium text-zinc-100 group-hover:text-gold-100">
                  {p.title}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-zinc-500">
                  {category ? `${category} · ` : ""}
                  {p.excerpt}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        href="/research"
        className="mono mt-3 inline-block text-[11px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-gold-200"
      >
        All research →
      </Link>
    </section>
  );
}
