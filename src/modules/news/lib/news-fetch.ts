import { unstable_cache } from "next/cache";
import { NEWS_SOURCES, favicon, type NewsSource } from "@/lib/news-sources";
import { parseFeed, categorize, sentiment, impact, relatedTokens, dedupe, rankNews, type NewsItem } from "@/lib/news";

// Server-side news aggregation shared by the API route and the /news page (so
// the first batch can be server-rendered for an instant first paint). Keyless.
// Was 20s - this caches per-source-URL (one Data Cache entry per RSS feed), so
// with a couple dozen sources a short window multiplies into a large share of
// Vercel's ISR Writes quota.
//
// ⚠️ 90s -> 120s, and the 30s of margin is the entire point. `NewsClient` polls
// `/api/news` every **90s** (`NEWS_POLL_MS`), and this const set both that
// route's `revalidate` and its `s-maxage` to exactly 90 as well. A window equal
// to the poll that drives it means every tick lands on the boundary and jitter
// decides whether it regenerates - so in practice most polls did, and `/news`
// showed **560 ISR Writes against 166 Reads** in Vercel analytics, the worst
// ratio on the site.
//
// This is the same defect `markets-poll-alignment.test.ts` was written for,
// twice. It did not catch this one because `/api/news` was never in its
// TARGETS list - the poll lives in `NewsClient.tsx`, not in the markets client
// the test globbed. That test now covers this route too.
export const NEWS_REVALIDATE = 120; // seconds - must stay > the 90s client poll

export type NewsPage = {
  items: NewsItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  live: boolean;
  ts: number;
};

async function fetchSource(src: NewsSource): Promise<NewsItem[]> {
  try {
    // Hard timeout so no single slow/hanging feed can stall the request (or the
    // build-time prerender of /news). AbortSignal.timeout is available on Node 18+.
    const res = await fetch(src.url, {
      headers: { accept: "application/rss+xml, application/xml, text/xml", "user-agent": "Mozilla/5.0 (compatible; XYZCryptoNews/1.0)" },
      next: { revalidate: NEWS_REVALIDATE },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const icon = favicon(src.domain);
    return parseFeed(xml).map((r) => {
      const text = `${r.title} ${r.summary}`;
      const { primary, all } = categorize(text);
      return {
        id: r.url,
        title: r.title,
        url: r.url,
        summary: r.summary,
        source: src.name,
        sourceIcon: icon,
        image: r.image,
        publishedAt: r.publishedAt,
        category: primary,
        categories: all,
        sentiment: sentiment(text),
        impact: impact(text),
        tokens: relatedTokens(text),
      } satisfies NewsItem;
    });
  } catch {
    return [];
  }
}

// The expensive part - fetching every source's feed and classifying every
// article (categorize/sentiment/impact/relatedTokens, all regex/string work) -
// is independent of category/q/page. Without this, every distinct query-string
// combination (category tabs x search x pagination) was a cache miss that
// reran classification over every source from scratch, which was the single
// biggest driver of Fluid Active CPU usage. Caching it once, decoupled from
// per-request params, means classification now runs at most once per
// NEWS_REVALIDATE window regardless of how many different views hit it.
const getClassifiedItems = unstable_cache(
  async () => {
    const batches = await Promise.all(NEWS_SOURCES.map(fetchSource));
    return {
      items: dedupe(batches.flat().filter((i) => i.publishedAt > 0)),
      live: batches.some((b) => b.length > 0),
    };
  },
  ["news-classified-items"],
  { revalidate: NEWS_REVALIDATE }
);

/**
 * Find one story by its source URL, across the WHOLE classified pool.
 *
 * `getNewsPage` cannot do this: its `pageSize` is clamped to 30, so the share
 * page was only ever looking at the newest 30 stories. Any link shared for a
 * story that had since been pushed past that - which on a 29-feed aggregator is
 * a matter of minutes - fell through to a stub card titled "News on XYZ Crypto",
 * with no image, no summary and no source. The share worked; the card that
 * represented it went generic almost immediately.
 *
 * Costs nothing extra: the pool is the same `unstable_cache` entry the feed
 * itself is served from, so this is a lookup in memory that is already warm.
 */
export async function findNewsByUrl(url: string): Promise<NewsItem | null> {
  const { items } = await getClassifiedItems();
  return items.find((i) => i.url === url) ?? null;
}

let defaultRankedCache: { items: NewsItem[]; ts: number; sourceItems: NewsItem[] } | null = null;

function getRankedDefaultFeed(allItems: NewsItem[]): NewsItem[] {
  const now = Date.now();
  if (defaultRankedCache && defaultRankedCache.sourceItems === allItems && now - defaultRankedCache.ts < 15_000) {
    return defaultRankedCache.items;
  }
  const ranked = rankNews(allItems, now);
  defaultRankedCache = { items: ranked, ts: now, sourceItems: allItems };
  return ranked;
}

/** Fetch, classify, de-dupe, filter and paginate the live news feed. */
export async function getNewsPage(opts: { category?: string; q?: string; page?: number; pageSize?: number } = {}): Promise<NewsPage> {
  const category = opts.category || "All";
  const q = (opts.q || "").trim().toLowerCase();
  const page = Math.max(1, opts.page || 1);
  const pageSize = Math.min(30, Math.max(6, opts.pageSize || 15));

  const { items: allItems, live } = await getClassifiedItems();
  const isDefault = category === "All" && !q;
  const items = isDefault
    ? getRankedDefaultFeed(allItems)
    : rankNews(
        allItems.filter((i) => (category === "All" || i.categories.includes(category)) && (!q || (i.title + " " + i.summary).toLowerCase().includes(q))),
        Date.now()
      );

  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
    live,
    ts: Date.now(),
  };
}
