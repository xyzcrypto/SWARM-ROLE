import { NextResponse } from "next/server";
import { topBy, type YieldPool } from "@/lib/markets";

// Top DeFi yield opportunities (DefiLlama yields, keyless). Filtered to pools
// with a meaningful TVL and a sane APY so the list stays trustworthy. Graceful.
// COUPLED to the poll interval in MarketsClient.tsx: this window must be >=
// how often the client refetches, or every poll lands on an expired window
// and regenerates the route (ISR Writes + Fluid CPU). Pinned by
// src/lib/__tests__/markets-poll-alignment.test.ts - change both together.
export const revalidate = 320;

export async function GET() {
  try {
    const res = await fetch("https://yields.llama.fi/pools", {
      headers: { accept: "application/json" },
      next: { revalidate },
    });
    if (!res.ok) throw new Error(`yields ${res.status}`);
    const j = await res.json();
    const raw: any[] = j?.data ?? [];
    const pools: YieldPool[] = topBy(
      raw
        .filter((p) => (Number(p.tvlUsd) || 0) >= 1_000_000 && (Number(p.apy) || 0) < 1000)
        .map((p) => ({
          project: String(p.project ?? "-"),
          symbol: String(p.symbol ?? "-"),
          chain: String(p.chain ?? "-"),
          apy: Number(p.apy) || 0,
          tvl: Number(p.tvlUsd) || 0,
        })),
      (p) => p.apy,
      10
    );
    return NextResponse.json(
      { pools, live: true, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch {
    return NextResponse.json(
      { pools: [], live: false, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=120" } }
    );
  }
}
