import { NextResponse } from "next/server";
import { cmcEnabled, env } from "@/lib/env";
import type { GlobalMarket } from "@/lib/markets";

// Server-side cached proxy: global crypto market snapshot. Aggregates keyless
// sources (CoinGecko /global + Fear&Greed) and, when a CMC key is set, enriches
// with CoinMarketCap DeFi/stablecoin market caps. Always returns 200 with a
// `live` flag (graceful) — the exact pattern used by /api/ticker.
export const revalidate = 60;

const FALLBACK: GlobalMarket = {
  marketCap: 2_350_000_000_000,
  volume24h: 92_000_000_000,
  btcDominance: 54,
  ethDominance: 13,
  mcapChange24h: 0,
  fearGreed: { value: 50, label: "Neutral" },
  defiMcap: null,
  stableMcap: null,
  gasGwei: null,
};

// Ethereum gas price via Cloudflare's public, keyless JSON-RPC. Best-effort.
async function ethGas(): Promise<number | null> {
  try {
    const res = await fetch("https://cloudflare-eth.com", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_gasPrice", params: [], id: 1 }),
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    const j = await res.json();
    const wei = Number.parseInt(j?.result, 16);
    return Number.isFinite(wei) ? Math.round((wei / 1e9) * 10) / 10 : null;
  } catch {
    return null;
  }
}

async function coingeckoGlobal() {
  const res = await fetch("https://api.coingecko.com/api/v3/global", {
    headers: { accept: "application/json" },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`coingecko ${res.status}`);
  const { data } = await res.json();
  return {
    marketCap: Number(data?.total_market_cap?.usd) || 0,
    volume24h: Number(data?.total_volume?.usd) || 0,
    btcDominance: Number(data?.market_cap_percentage?.btc) || 0,
    ethDominance: Number(data?.market_cap_percentage?.eth) || 0,
    mcapChange24h: Number(data?.market_cap_change_percentage_24h_usd) || 0,
  };
}

async function fearGreed() {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1", {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const j = await res.json();
    const row = j?.data?.[0];
    if (!row) return null;
    return { value: Number(row.value) || 0, label: String(row.value_classification || "") };
  } catch {
    return null;
  }
}

// CoinMarketCap enrichment (DeFi + stablecoin market cap). Best-effort, only when keyed.
async function cmcMetrics() {
  if (!cmcEnabled) return { defiMcap: null as number | null, stableMcap: null as number | null };
  try {
    const res = await fetch("https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest", {
      headers: { "X-CMC_PRO_API_KEY": env.CMC_API_KEY, accept: "application/json" },
      next: { revalidate: 300 }, // stay well within the free ~10k/mo cap
    });
    if (!res.ok) return { defiMcap: null, stableMcap: null };
    const { data } = await res.json();
    return {
      defiMcap: Number(data?.defi_market_cap) || null,
      stableMcap: Number(data?.stablecoin_market_cap) || null,
    };
  } catch {
    return { defiMcap: null, stableMcap: null };
  }
}

export async function GET() {
  try {
    const [core, fng, cmc, gas] = await Promise.all([coingeckoGlobal(), fearGreed(), cmcMetrics(), ethGas()]);
    const payload: GlobalMarket = { ...core, fearGreed: fng, defiMcap: cmc.defiMcap, stableMcap: cmc.stableMcap, gasGwei: gas };
    return NextResponse.json(
      { ...payload, live: true, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180" } }
    );
  } catch {
    return NextResponse.json(
      { ...FALLBACK, live: false, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=30" } }
    );
  }
}
