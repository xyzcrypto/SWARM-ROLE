import { NextResponse } from "next/server";
import type { DefiMarket } from "@/lib/markets";
import { topByTvl } from "@/lib/markets";

// Server-side cached proxy: DeFi snapshot from DefiLlama (keyless, free) - total
// TVL + trend, top protocols, top chains, stablecoin market cap. Always 200 with
// a `live` flag (graceful), like /api/ticker.
// COUPLED to the poll interval in MarketsClient.tsx: this window must be >=
// how often the client refetches, or every poll lands on an expired window
// and regenerates the route (ISR Writes + Fluid CPU). Pinned by
// src/lib/__tests__/markets-poll-alignment.test.ts - change both together.
export const revalidate = 200;

const FALLBACK: DefiMarket = {
  totalTvl: 118_000_000_000,
  tvlTrend: [],
  topProtocols: [],
  topChains: [],
  stableMcap: 165_000_000_000,
};

async function j(url: string, revalidateSec = revalidate) {
  const res = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate: revalidateSec } });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

async function totalTvlAndTrend() {
  // All-chains historical TVL: [{ date, tvl }] - last point is current total.
  const rows: { date: number; tvl: number }[] = await j("https://api.llama.fi/v2/historicalChainTvl");
  const trend = rows.slice(-30).map((r) => Number(r.tvl) || 0);
  const totalTvl = trend.length ? trend[trend.length - 1] : 0;
  return { totalTvl, tvlTrend: trend };
}

async function topProtocols() {
  const list: any[] = await j("https://api.llama.fi/protocols");
  return topByTvl(list.map((p) => ({ ...p, tvl: Number(p.tvl) || 0 })), 8).map((p: any) => ({
    name: String(p.name ?? "-"),
    tvl: Number(p.tvl) || 0,
    chain: String(p.chain ?? p.chains?.[0] ?? "-"),
    change1d: Number(p.change_1d) || 0,
    logo: typeof p.logo === "string" ? p.logo : null,
  }));
}

async function topChains() {
  const list: any[] = await j("https://api.llama.fi/v2/chains");
  return topByTvl(list.map((c) => ({ name: String(c.name ?? "-"), tvl: Number(c.tvl) || 0 })), 8);
}

async function stableMcap() {
  try {
    const data = await j("https://stablecoins.llama.fi/stablecoins?includePrices=false", 300);
    const assets: any[] = data?.peggedAssets ?? [];
    return assets.reduce((sum, a) => sum + (Number(a?.circulating?.peggedUSD) || 0), 0);
  } catch {
    return FALLBACK.stableMcap;
  }
}

export async function GET() {
  try {
    // Total TVL is the core signal; the rest are best-effort so one slow endpoint
    // can't blank the page.
    const core = await totalTvlAndTrend();
    const [protocols, chains, stable] = await Promise.all([
      topProtocols().catch(() => [] as DefiMarket["topProtocols"]),
      topChains().catch(() => [] as DefiMarket["topChains"]),
      stableMcap().catch(() => FALLBACK.stableMcap),
    ]);
    const payload: DefiMarket = {
      totalTvl: core.totalTvl,
      tvlTrend: core.tvlTrend,
      topProtocols: protocols,
      topChains: chains,
      stableMcap: stable,
    };
    return NextResponse.json(
      { ...payload, live: true, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=200, stale-while-revalidate=300" } }
    );
  } catch {
    return NextResponse.json(
      { ...FALLBACK, live: false, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=60" } }
    );
  }
}
