import { NextResponse } from "next/server";
import type { TrendingCoin, MoverCoin } from "@/lib/markets";

// Trending coins + 24h top gainers/losers (CoinGecko, keyless). Graceful.
export const revalidate = 60;

async function trending(): Promise<TrendingCoin[]> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/search/trending", {
      headers: { accept: "application/json" },
      next: { revalidate },
    });
    if (!res.ok) return [];
    const j = await res.json();
    return (j?.coins ?? []).slice(0, 8).map((c: any) => ({
      name: String(c?.item?.name ?? "—"),
      symbol: String(c?.item?.symbol ?? "").toUpperCase(),
      thumb: typeof c?.item?.thumb === "string" ? c.item.thumb : null,
      change24h: Number(c?.item?.data?.price_change_percentage_24h?.usd) || 0,
    }));
  } catch {
    return [];
  }
}

async function movers(): Promise<{ gainers: MoverCoin[]; losers: MoverCoin[] }> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&price_change_percentage=24h",
    { headers: { accept: "application/json" }, next: { revalidate } }
  );
  if (!res.ok) throw new Error(`markets ${res.status}`);
  const data: any[] = await res.json();
  const rows: MoverCoin[] = data
    .map((d) => ({
      name: String(d.name ?? "—"),
      symbol: String(d.symbol ?? "").toUpperCase(),
      image: typeof d.image === "string" ? d.image : null,
      price: Number(d.current_price) || 0,
      change24h: Number(d.price_change_percentage_24h) || 0,
    }))
    .filter((r) => Number.isFinite(r.change24h));
  const sorted = [...rows].sort((a, b) => b.change24h - a.change24h);
  return { gainers: sorted.slice(0, 6), losers: sorted.slice(-6).reverse() };
}

export async function GET() {
  try {
    const [trend, mv] = await Promise.all([trending(), movers()]);
    return NextResponse.json(
      { trending: trend, gainers: mv.gainers, losers: mv.losers, live: true, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180" } }
    );
  } catch {
    return NextResponse.json(
      { trending: [], gainers: [], losers: [], live: false, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=30" } }
    );
  }
}
