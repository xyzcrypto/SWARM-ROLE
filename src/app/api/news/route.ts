import { NextResponse } from "next/server";
import { NEWS_SOURCES, favicon, type NewsSource } from "@/lib/news-sources";
import {
  parseFeed,
  categorize,
  sentiment,
  impact,
  relatedTokens,
  dedupe,
  type NewsItem,
} from "@/lib/news";

// Live Web3 news — aggregates reputable RSS/Atom feeds server-side (keyless),
// classifies each story, de-duplicates the same event across outlets, and
// filters/paginates. Cached + graceful always-200 (empty on total failure).
export const revalidate = 60;

async function fetchSource(src: NewsSource): Promise<NewsItem[]> {
  try {
    const res = await fetch(src.url, {
      headers: { accept: "application/rss+xml, application/xml, text/xml", "user-agent": "Mozilla/5.0 (compatible; XYZCryptoNews/1.0)" },
      next: { revalidate },
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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "All";
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(30, Math.max(6, Number(searchParams.get("pageSize")) || 15));

    const batches = await Promise.all(NEWS_SOURCES.map(fetchSource));
    let items = dedupe(batches.flat().filter((i) => i.publishedAt > 0));

    if (category && category !== "All") items = items.filter((i) => i.categories.includes(category));
    if (q) items = items.filter((i) => (i.title + " " + i.summary).toLowerCase().includes(q));

    const total = items.length;
    const start = (page - 1) * pageSize;
    const pageItems = items.slice(start, start + pageSize);
    const live = batches.some((b) => b.length > 0);

    return NextResponse.json(
      { items: pageItems, total, page, pageSize, hasMore: start + pageSize < total, live, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180" } }
    );
  } catch {
    return NextResponse.json(
      { items: [], total: 0, page: 1, pageSize: 15, hasMore: false, live: false, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=30" } }
    );
  }
}
