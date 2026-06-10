import { NextResponse } from "next/server";

// Server-side cached proxy for live market data (CoinGecko /coins/markets).
// Caching => at most one upstream call per `revalidate` window for ALL
// visitors, which avoids client-side rate limiting (429/529) & CORS, and
// returns each coin's logo + name + price + 24h change in one call.
export const revalidate = 10;

const COINS = [
  { symbol: "BTC", name: "Bitcoin", id: "bitcoin", seed: 68420 },
  { symbol: "ETH", name: "Ethereum", id: "ethereum", seed: 3540 },
  { symbol: "SOL", name: "Solana", id: "solana", seed: 168.4 },
  { symbol: "SUI", name: "Sui", id: "sui", seed: 2.14 },
  { symbol: "HYPE", name: "Hyperliquid", id: "hyperliquid", seed: 27.8 },
  { symbol: "BNB", name: "BNB", id: "binancecoin", seed: 605 },
  { symbol: "XRP", name: "XRP", id: "ripple", seed: 0.62 },
  { symbol: "DOGE", name: "Dogecoin", id: "dogecoin", seed: 0.16 },
  { symbol: "AVAX", name: "Avalanche", id: "avalanche-2", seed: 38.2 },
  { symbol: "LINK", name: "Chainlink", id: "chainlink", seed: 18.6 },
];

const LOGO: Record<string, string> = {
  BTC: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
  ETH: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  SOL: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
  SUI: "https://assets.coingecko.com/coins/images/26375/small/sui-ocean-square.png",
  HYPE: "https://assets.coingecko.com/coins/images/50882/small/hyperliquid.jpg",
  BNB: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
  XRP: "https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png",
  DOGE: "https://assets.coingecko.com/coins/images/5/small/dogecoin.png",
  AVAX: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
  LINK: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png",
};

const fallback = COINS.map((c) => ({
  symbol: c.symbol,
  name: c.name,
  price: c.seed,
  change: ((c.seed % 7) - 3) * 0.9,
  image: LOGO[c.symbol],
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
      image: d?.image ?? LOGO[c.symbol],
    };
  });
}

export async function GET() {
  try {
    const coins = await fetchUpstream();
    return NextResponse.json(
      { coins, live: true, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" } }
    );
  } catch {
    return NextResponse.json(
      { coins: fallback, live: false, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=8" } }
    );
  }
}
