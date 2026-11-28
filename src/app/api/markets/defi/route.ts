import { NextResponse } from "next/server";
import type { DefiMarket } from "@/lib/markets";
import { llamaProtocols } from "@modules/markets/lib/llama";
import { lastGood } from "@modules/markets/lib/last-good";
import { topByTvl } from "@/lib/markets";

const SIX_HOURS = 6 * 60 * 60_000;

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
  stableMcap: null,
};

async function j(url: string, revalidateSec = revalidate) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { accept: "application/json" }, next: { revalidate: revalidateSec } });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

async function totalTvlAndTrend() {
  // All-chains historical TVL: [{ date, tvl }] - last point is current total.
  return lastGood(
    "defi:tvl",
    async () => {
      const rows: { date: number; tvl: number }[] = await j("https://api.llama.fi/v2/historicalChainTvl");
      const trend = rows.slice(-30).map((r) => Number(r.tvl) || 0);
      const totalTvl = trend.length ? trend[trend.length - 1] : 0;
      return { totalTvl, tvlTrend: trend };
    },
    { isGood: (v) => v.totalTvl > 0, maxAgeMs: SIX_HOURS }
  );
}

async function topProtocols() {
  // `api.llama.fi/protocols` is 11.4 MB and we keep eight rows. The fetch and
  // the trim moved to `llama.ts` so the small result is what gets cached - the
  // >2 MB body never could be. See the note there.
  return topByTvl(await llamaProtocols(), 8);
}

async function topChains() {
  return lastGood(
    "defi:chains",
    async () => {
      const list: any[] = await j("https://api.llama.fi/v2/chains");
      return topByTvl(list.map((c) => ({ name: String(c.name ?? "-"), tvl: Number(c.tvl) || 0 })), 8);
    },
    { isGood: (v) => v.length > 0, maxAgeMs: SIX_HOURS }
  );
}

// A failed read used to return FALLBACK.stableMcap (a 2024 figure) inside a
// `live: true` payload, so a stale constant was shown as today's stablecoin
// supply. It now returns the last real reading, or null ("-").
async function stableMcap(): Promise<number | null> {
  return lastGood(
    "defi:stable",
    async () => {
      const data = await j("https://stablecoins.llama.fi/stablecoins?includePrices=false", 300);
      const assets: any[] = data?.peggedAssets ?? [];
      return assets.reduce((sum, a) => sum + (Number(a?.circulating?.peggedUSD) || 0), 0) as number;
    },
    { isGood: (v) => v > 0, maxAgeMs: SIX_HOURS }
  ).catch(() => null);
}

export async function GET() {
  try {
    // Total TVL is the core signal; the rest are best-effort so one slow endpoint
    // can't blank the page.
    const core = await totalTvlAndTrend();
    const [protocols, chains, stable] = await Promise.all([
      topProtocols().catch(() => [] as DefiMarket["topProtocols"]),
      topChains().catch(() => [] as DefiMarket["topChains"]),
      stableMcap(),
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
