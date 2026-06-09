import { NextResponse } from "next/server";

// Server-side, cached proxy for market prices. Caching means we hit the
// upstream API at most once per `revalidate` window for ALL visitors — this
// avoids client-side rate limiting (HTTP 429/529) and CORS issues.
export const revalidate = 60;

const COINS = [
  { symbol: "BTC", name: "Bitcoin", id: "bitcoin", seed: 68420 },
  { symbol: "ETH", name: "Ethereum", id: "ethereum", seed: 3540 },
  { symbol: "SOL", name: "Solana", id: "solana", seed: 168.4 },
  { symbol: "SUI", name: "Sui", id: "sui", seed: 2.14 },
  { symbol: "HYPE", name: "Hyperliquid", id: "hyperliquid", seed: 27.8 },
];

const fallback = COINS.map((c) => ({
  symbol: c.symbol,
  price: c.seed,
  change: ((c.seed % 7) - 3) * 0.9,
}));

async function fetchUpstream() {
  const ids = COINS.map((c) => c.id).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const data = await res.json();
  return COINS.map((c) => ({
    symbol: c.symbol,
    price: data[c.id]?.usd ?? c.seed,
    change: data[c.id]?.usd_24h_change ?? 0,
  }));
}

export async function GET() {
  try {
    const coins = await fetchUpstream();
    return NextResponse.json(
      { coins, live: true },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
    );
  } catch {
    return NextResponse.json(
      { coins: fallback, live: false },
      { headers: { "Cache-Control": "public, s-maxage=30" } }
    );
  }
}
