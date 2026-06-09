import { NextResponse } from "next/server";

// Cached server proxy for a real price chart (CoinGecko market_chart).
// One upstream call per `revalidate` window for all visitors (no 429/529).
export const revalidate = 120;

// Plausible fallback shape if upstream is unreachable (e.g. firewalled).
const FALLBACK = (() => {
  const pts: number[] = [];
  let v = 64000;
  for (let i = 0; i < 48; i++) {
    v += Math.sin(i / 4) * 320 + (i - 24) * 55;
    pts.push(Math.round(v));
  }
  return pts;
})();

export async function GET() {
  try {
    const url =
      "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1";
    const res = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = await res.json();
    const raw: [number, number][] = data.prices ?? [];
    // downsample to ~48 points
    const step = Math.max(1, Math.floor(raw.length / 48));
    const points = raw.filter((_, i) => i % step === 0).map((p) => p[1]);
    const price = points[points.length - 1] ?? FALLBACK[FALLBACK.length - 1];
    const first = points[0] ?? FALLBACK[0];
    const change = first ? ((price - first) / first) * 100 : 0;
    return NextResponse.json(
      { points, price, change, live: true },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } }
    );
  } catch {
    const price = FALLBACK[FALLBACK.length - 1];
    const change = ((price - FALLBACK[0]) / FALLBACK[0]) * 100;
    return NextResponse.json(
      { points: FALLBACK, price, change, live: false },
      { headers: { "Cache-Control": "public, s-maxage=60" } }
    );
  }
}
