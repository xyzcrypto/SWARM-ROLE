import { NEWS_SOURCES, favicon, type NewsSource } from "@/lib/news-sources";
import { parseFeed, categorize, sentiment, impact, relatedTokens, dedupe, type NewsItem } from "@/lib/news";

// Server-side news aggregation shared by the API route and the /news page (so
// the first batch can be server-rendered for an instant first paint). Keyless.
export const NEWS_REVALIDATE = 30; // seconds — fresher than before (was 60)

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

/** Fetch, classify, de-dupe, filter and paginate the live news feed. */
export async function getNewsPage(opts: { category?: string; q?: string; page?: number; pageSize?: number } = {}): Promise<NewsPage> {
  const category = opts.category || "All";
  const q = (opts.q || "").trim().toLowerCase();
  const page = Math.max(1, opts.page || 1);
  const pageSize = Math.min(30, Math.max(6, opts.pageSize || 15));

  const batches = await Promise.all(NEWS_SOURCES.map(fetchSource));
  let items = dedupe(batches.flat().filter((i) => i.publishedAt > 0));
  if (category !== "All") items = items.filter((i) => i.categories.includes(category));
  if (q) items = items.filter((i) => (i.title + " " + i.summary).toLowerCase().includes(q));

  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
    live: batches.some((b) => b.length > 0),
    ts: Date.now(),
  };
}
