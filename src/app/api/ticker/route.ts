import { NextResponse } from "next/server";

// Server-side cached proxy for live market data (CoinGecko /coins/markets).
// Caching => at most one upstream call per `revalidate` window for ALL
// visitors, which avoids client-side rate limiting (429/529) & CORS, and
// returns each coin's logo + name + price + 24h change in one call.
export const revalidate = 10;

const COINS = [
  { symbol: "BTC", name: "Bitcoin", id: "bitcoin", binance: "BTCUSDT", seed: 68420 },
  { symbol: "ETH", name: "Ethereum", id: "ethereum", binance: "ETHUSDT", seed: 3540 },
  { symbol: "SOL", name: "Solana", id: "solana", binance: "SOLUSDT", seed: 168.4 },
  { symbol: "SUI", name: "Sui", id: "sui", binance: "SUIUSDT", seed: 2.14 },
  { symbol: "HYPE", name: "Hyperliquid", id: "hyperliquid", binance: "HYPEUSDT", seed: 27.8 },
  { symbol: "BNB", name: "BNB", id: "binancecoin", binance: "BNBUSDT", seed: 605 },
  { symbol: "XRP", name: "XRP", id: "ripple", binance: "XRPUSDT", seed: 0.62 },
  { symbol: "DOGE", name: "Dogecoin", id: "dogecoin", binance: "DOGEUSDT", seed: 0.16 },
  { symbol: "AVAX", name: "Avalanche", id: "avalanche-2", binance: "AVAXUSDT", seed: 38.2 },
  { symbol: "LINK", name: "Chainlink", id: "chainlink", binance: "LINKUSDT", seed: 18.6 },
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

// Last successful upstream fetch, kept in module memory (persists across
// requests on a warm serverless instance). Used instead of the hardcoded
// `fallback` seed data during a transient CoinGecko outage/rate-limit, so
// repeated failures serve slightly-stale-but-real prices rather than the
// exact same numbers every time (which reads as "the ticker is frozen").
let lastGood: { coins: typeof fallback; ts: number } | null = null;

async function fetchFromCoinGecko() {
  const ids = COINS.map((c) => c.id).join(",");
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=24h`;
  const res = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate } });
  if (!res.ok) throw new Error(`coingecko ${res.status}`);
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

// CoinGecko's free/keyless API rate-limits shared cloud IPs (like Vercel's)
// aggressively - a very common real-world cause of a ticker that's stuck on
// fallback numbers indefinitely, not just during brief blips. Binance's public
// ticker is also free and keyless, but has much more generous per-IP limits,
// so it's a solid second opinion when CoinGecko itself is unreachable.
async function fetchFromBinance() {
  const symbols = JSON.stringify(COINS.map((c) => c.binance));
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbols)}`;
  const res = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate } });
  if (!res.ok) throw new Error(`binance ${res.status}`);
  const data: any[] = await res.json();
  const bySymbol = new Map(data.map((d) => [d.symbol, d]));
  return COINS.map((c) => {
    const d = bySymbol.get(c.binance);
    return {
      symbol: c.symbol,
      name: c.name,
      price: d ? Number(d.lastPrice) : c.seed,
      change: d ? Number(d.priceChangePercent) : 0,
      image: LOGO[c.symbol],
    };
  });
}

// Binance.com itself geo-blocks requests from the US and several other
// jurisdictions (HTTP 451) - a real risk since Vercel's default serverless
// region is US-based, which would silently defeat the Binance fallback above
// for exactly the visitors it's meant to help. CryptoCompare's free/keyless
// multi-symbol endpoint is a third, differently-hosted opinion with no such
// geo-block, so CoinGecko and Binance would have to fail for unrelated
// reasons (rate-limit + geo-block) at the same moment for this to matter.
async function fetchFromCryptoCompare() {
  const fsyms = COINS.map((c) => c.symbol).join(",");
  const url = `https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${fsyms}&tsyms=USD`;
  const res = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate } });
  if (!res.ok) throw new Error(`cryptocompare ${res.status}`);
  const data = await res.json();
  const raw = data?.RAW ?? {};
  return COINS.map((c) => {
    const d = raw?.[c.symbol]?.USD;
    return {
      symbol: c.symbol,
      name: c.name,
      price: d?.PRICE ?? c.seed,
      change: d?.CHANGEPCT24HOUR ?? 0,
      image: LOGO[c.symbol],
    };
  });
}

async function fetchUpstream() {
  try {
    return await fetchFromCoinGecko();
  } catch {
    try {
      return await fetchFromBinance();
    } catch {
      return await fetchFromCryptoCompare();
    }
  }
}

export async function GET() {
  try {
    const coins = await fetchUpstream();
    lastGood = { coins, ts: Date.now() };
    return NextResponse.json(
      { coins, live: true, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" } }
    );
  } catch {
    // Both upstreams failed - prefer the last real prices we successfully
    // fetched over the hardcoded seed data, so repeated failures serve
    // slightly-stale-but-real numbers instead of the exact same hardcoded
    // values every time (which reads as "the ticker is frozen").
    return NextResponse.json(
      { coins: lastGood?.coins ?? fallback, live: false, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=8" } }
    );
  }
}
