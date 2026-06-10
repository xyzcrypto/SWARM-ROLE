import { NextResponse } from "next/server";

// Cached server proxy for real OHLC candlestick data (CoinGecko /ohlc).
// Supports ?coin=bitcoin|ethereum & ?days=1|7|30. Each (coin,days) URL is
// cached separately at the fetch level.

const COINS: Record<string, { symbol: string; base: number }> = {
  bitcoin: { symbol: "BTC", base: 64000 },
  ethereum: { symbol: "ETH", base: 3400 },
};
const ALLOWED_DAYS = new Set([1, 7, 30]);

// Synthetic OHLC fallback if upstream is unreachable.
function makeFallback(base: number) {
  const candles: number[][] = [];
  let prev = base;
  for (let i = 0; i < 44; i++) {
    const drift = Math.sin(i / 5) * (base * 0.012) + (i - 22) * (base * 0.0011);
    const open = prev;
    const close = open + drift + (Math.random() - 0.5) * base * 0.01;
    const high = Math.max(open, close) + Math.random() * base * 0.006;
    const low = Math.min(open, close) - Math.random() * base * 0.006;
    candles.push([open, high, low, close].map((v) => Math.round(v * 100) / 100));
    prev = close;
  }
  return candles;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const coin = (searchParams.get("coin") || "bitcoin").toLowerCase();
  let days = parseInt(searchParams.get("days") || "1", 10);
  if (!ALLOWED_DAYS.has(days)) days = 1;
  const meta = COINS[coin] ?? COINS.bitcoin;

  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coin}/ohlc?vs_currency=usd&days=${days}`;
    const res = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate: 120 } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const raw: number[][] = await res.json(); // [t, o, h, l, c]
    const step = Math.max(1, Math.floor(raw.length / 44));
    const candles = raw.filter((_, i) => i % step === 0).map((c) => [c[1], c[2], c[3], c[4]]);
    const price = candles.length ? candles[candles.length - 1][3] : meta.base;
    const first = candles.length ? candles[0][0] : meta.base;
    const change = first ? ((price - first) / first) * 100 : 0;
    return NextResponse.json(
      { symbol: meta.symbol, candles, price, change, live: true },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } }
    );
  } catch {
    const candles = makeFallback(meta.base);
    const price = candles[candles.length - 1][3];
    const change = ((price - candles[0][0]) / candles[0][0]) * 100;
    return NextResponse.json(
      { symbol: meta.symbol, candles, price, change, live: false },
      { headers: { "Cache-Control": "public, s-maxage=60" } }
    );
  }
}
