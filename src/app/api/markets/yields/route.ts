import { NextResponse } from "next/server";
import { topBy, type YieldPool } from "@/lib/markets";
import { llamaYieldPools } from "@modules/markets/lib/llama";

// Top DeFi yield opportunities (DefiLlama yields, keyless). Filtered to pools
// with a meaningful TVL and a sane APY so the list stays trustworthy. Graceful.
// COUPLED to the poll interval in MarketsClient.tsx: this window must be >=
// how often the client refetches, or every poll lands on an expired window
// and regenerates the route (ISR Writes + Fluid CPU). Pinned by
// src/lib/__tests__/markets-poll-alignment.test.ts - change both together.
export const revalidate = 320;

/**
 * A pool's real APY history: DefiLlama's daily series for that pool, last 30
 * days. ~100 KB per pool, well under the 2 MB data-cache ceiling, so the
 * `revalidate` hint genuinely caches it (cost-check trap 1b: same window as the
 * route). A pool whose history does not answer simply has no chart.
 */
async function apyHistory(pool: string | null | undefined): Promise<number[] | undefined> {
  if (!pool) return undefined;
  try {
    const res = await fetch(`https://yields.llama.fi/chart/${encodeURIComponent(pool)}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(6000),
      next: { revalidate },
    });
    if (!res.ok) return undefined;
    const data: any[] = (await res.json())?.data;
    if (!Array.isArray(data)) return undefined;
    const series = data
      .slice(-30)
      .map((d) => Number(d?.apy))
      .filter((v) => Number.isFinite(v));
    return series.length >= 2 ? series : undefined;
  } catch {
    return undefined;
  }
}

export async function GET() {
  try {
    // The 14.3 MB fetch, its TVL/APY filter and its trim now live in
    // `llama.ts`, cached as a reduced value the data cache can actually hold -
    // see the note there. Same filter, same ordering, same ten rows.
    const top = topBy(await llamaYieldPools(), (p) => p.apy, 10);
    const histories = await Promise.all(top.map((p) => apyHistory(p.pool)));
    const pools: YieldPool[] = top.map(({ pool: _pool, ...p }, i) => ({ ...p, sparkline: histories[i] }));
    return NextResponse.json(
      { pools, live: true, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=320, stale-while-revalidate=600" } }
    );
  } catch {
    return NextResponse.json(
      { pools: [], live: false, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=120" } }
    );
  }
}
