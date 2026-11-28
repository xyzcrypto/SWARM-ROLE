import { NextResponse } from "next/server";
import { MARKET_CATEGORIES } from "@/lib/markets";

/**
 * Which coins are in a category — ids only.
 *
 * ## Why this shape, and why it is cheap
 *
 * CoinGecko's `/coins/markets` does not carry per-coin categories, so knowing
 * that SOL is an L1 needs a request. Three ways to get it, and the cost is the
 * whole reason for this comment (`cost-check`: a new external fetch is a cost
 * decision, and this project has had a real Vercel overage):
 *
 *  1. A hand-written map of coin → category. No requests, but wrong the moment
 *     a new coin enters the top 250, and "add more data with accuracy" was the
 *     ask.
 *  2. Fetch every category up front. Accurate, but eight requests per
 *     revalidation for readers who never touch the filter - which is most.
 *  3. This: fetch ONE category, only when someone selects it. Readers who never
 *     filter cost nothing at all, and the answer comes from the source.
 *
 * Returning only ids, not rows, is what keeps it small and lets the client
 * filter the 250 coins it already has rather than re-render from a second
 * source that could disagree with the first.
 *
 * Window matches `/api/markets/coins` (200s): the two are read together, so a
 * shorter one here would just add regenerations without making the filtered
 * table any fresher than the rows it filters.
 */
export const revalidate = 200;


const ALLOWED = new Set<string>(MARKET_CATEGORIES.map((c) => c.id));

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  // Allow-listed rather than sanitised: this value is interpolated into an
  // upstream URL, and the set of categories the UI can ask for is closed.
  if (!ALLOWED.has(id)) {
    return NextResponse.json({ ids: [], live: false, error: "Unknown category." }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=${id}&order=market_cap_desc&per_page=250&page=1`,
      { signal: AbortSignal.timeout(8000), headers: { accept: "application/json" }, next: { revalidate } }
    );
    if (!res.ok) throw new Error(`category ${res.status}`);
    const data: Array<{ id?: unknown }> = await res.json();
    const ids = data.map((d) => String(d?.id ?? "")).filter(Boolean);
    return NextResponse.json(
      { ids, live: true, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=200, stale-while-revalidate=300" } }
    );
  } catch {
    // Graceful and always-200-shaped like every other markets route, so the
    // client's `live` guard is the single place that decides what to trust.
    return NextResponse.json(
      { ids: [], live: false, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=30" } }
    );
  }
}
