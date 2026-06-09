import { NextResponse } from "next/server";

// Server-side, cached proxy for market data. Caching means we hit the upstream
// API at most once per `revalidate` window for ALL visitors — avoids
// client-side rate limiting (429/529) & CORS. Uses /coins/markets so we also
// get each coin's logo + name in one call.
export const revalidate = 20;

const COINS = [
  { symbol: "BTC", name: "Bitcoin", id: "bitcoin", seed: 68420, img: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png" },
  { symbol: "ETH", name: "Ethereum", id: "ethereum", seed: 3540, img: "https://assets.coingecko.com/coins/images/279/small/ethereum.png" },
  { symbol: "SOL", name: "Solana", id: "solana", seed: 168.4, img: "https://assets.coingecko.com/coins/images/4128/small/solana.png" },
  { symbol: "SUI", name: "Sui", id: "sui", seed: 2.14, img: "https://assets.coingecko.com/coins/images/26375/small/sui-ocean-square.png" },
  { symbol: "HYPE", name: "Hyperliquid", id: "hyperliquid", seed: 27.8, img: "https://assets.coingecko.com/coins/images/50882/small/hyperliquid.jpg" },
];

const fallback = COINS.map((c) => ({
  symbol: c.symbol,
  name: c.name,
  price: c.seed,
  change: ((c.seed % 7) - 3) * 0.9,
  image: c.img,
}));

async function fetchUpstream() {
  const ids = COINS.map((c) => c.id).join(",");
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=24h`;
  const res = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate } });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const data: any[] = await res.json();
  const byId = new Map(data.map((d) => [d.id, d]));
  return COINS.map((c) => {
    const d = byId.get(c.id);
    return {
      symbol: c.symbol,
      name: c.name,
      price: d?.current_price ?? c.seed,
      change: d?.price_change_percentage_24h ?? 0,
      image: d?.image ?? c.img,
    };
  });
}

export async function GET() {
  try {
    const coins = await fetchUpstream();
    return NextResponse.json(
      { coins, live: true },
      { headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=60" } }
    );
  } catch {
    return NextResponse.json(
      { coins: fallback, live: false },
      { headers: { "Cache-Control": "public, s-maxage=15" } }
    );
  }
}
