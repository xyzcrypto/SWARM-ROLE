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

export async function GET() {
  try {
    // The 14.3 MB fetch, its TVL/APY filter and its trim now live in
    // `llama.ts`, cached as a reduced value the data cache can actually hold -
    // see the note there. Same filter, same ordering, same ten rows.
    const pools: YieldPool[] = topBy(await llamaYieldPools(), (p) => p.apy, 10);
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
