import { NextResponse } from "next/server";
import { getNewsPage } from "@/lib/news-fetch";

// Live Web3 news - aggregates reputable RSS/Atom feeds server-side (keyless),
// classifies each story, de-duplicates the same event across outlets, and
// filters/paginates. Cached + graceful always-200 (empty on total failure).
// Next 16 requires a statically-analyzable literal here (an imported const is
// rejected as an invalid segment config). Keep in sync with NEWS_REVALIDATE in
// src/lib/news-fetch.ts.
export const revalidate = 120;

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
      // s-maxage is what the EDGE honours, not the `revalidate` above, so both
      // have to clear the 90s client poll - see NEWS_REVALIDATE for the measured
      // reason. Kept equal to `revalidate` on purpose.
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json(
      { items: [], total: 0, page: 1, pageSize: 15, hasMore: false, live: false, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=15" } }
    );
  }
}
