import { NextResponse } from "next/server";
import { getNewsPage, NEWS_REVALIDATE } from "@/lib/news-fetch";

// Live Web3 news - aggregates reputable RSS/Atom feeds server-side (keyless),
// classifies each story, de-duplicates the same event across outlets, and
// filters/paginates. Cached + graceful always-200 (empty on total failure).
export const revalidate = NEWS_REVALIDATE;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const data = await getNewsPage({
      category: searchParams.get("category") || "All",
      q: searchParams.get("q") || "",
      page: Number(searchParams.get("page")) || 1,
      pageSize: Number(searchParams.get("pageSize")) || 15,
    });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
    });
  } catch {
    return NextResponse.json(
      { items: [], total: 0, page: 1, pageSize: 15, hasMore: false, live: false, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=15" } }
    );
  }
}
