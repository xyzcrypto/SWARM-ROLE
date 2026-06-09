import { NextResponse } from "next/server";

// Cached server proxy for a real price chart (CoinGecko market_chart).
// Supports ?coin=bitcoin|ethereum. Each coin URL is cached separately at the
// fetch level, so one upstream call per coin per window for all visitors.

const COINS: Record<string, { symbol: string; base: number }> = {
  bitcoin: { symbol: "BTC", base: 64000 },
  ethereum: { symbol: "ETH", base: 3400 },
};

function makeFallback(base: number) {
  const pts: number[] = [];
  let v = base;
  for (let i = 0; i < 48; i++) {
    v += Math.sin(i / 4) * (base * 0.005) + (i - 24) * (base * 0.0009);
    pts.push(Math.round(v * 100) / 100);
  }
  return pts;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const coin = (searchParams.get("coin") || "bitcoin").toLowerCase();
  const meta = COINS[coin] ?? COINS.bitcoin;

  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=usd&days=1`;
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 120 },
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = await res.json();
    const raw: [number, number][] = data.prices ?? [];
    const step = Math.max(1, Math.floor(raw.length / 48));
    const points = raw.filter((_, i) => i % step === 0).map((p) => p[1]);
    const price = points[points.length - 1] ?? meta.base;
    const first = points[0] ?? meta.base;
    const change = first ? ((price - first) / first) * 100 : 0;
    return NextResponse.json(
      { symbol: meta.symbol, points, price, change, live: true },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } }
    );
  } catch {
    const pts = makeFallback(meta.base);
    const price = pts[pts.length - 1];
    const change = ((price - pts[0]) / pts[0]) * 100;
    return NextResponse.json(
      { symbol: meta.symbol, points: pts, price, change, live: false },
      { headers: { "Cache-Control": "public, s-maxage=60" } }
    );
  }
}
