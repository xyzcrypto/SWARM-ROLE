import { NextResponse } from "next/server";
import type { TrendingCoin, MoverCoin, CoinRow } from "@/lib/markets";

// Coins snapshot (CoinGecko, keyless): a top-250 market table (price, 1h/24h/7d
// %, mcap, volume, 7d sparkline) + trending + 24h gainers/losers, all derived from
// one markets call. Graceful always-200 `live` flag. (For coins beyond the top
// 250, the /api/markets/search route looks up any coin on demand.)
// Was 45s - lengthened along with the other markets routes to stay well under
// Vercel's free-tier ISR Writes quota.
export const revalidate = 120;

async function trending(): Promise<TrendingCoin[]> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/search/trending", {
      headers: { accept: "application/json" },
      next: { revalidate: 120 },
    });
    if (!res.ok) return [];
    const j = await res.json();
    return (j?.coins ?? []).slice(0, 8).map((c: any) => ({
      id: String(c?.item?.id ?? ""),
      name: String(c?.item?.name ?? "-"),
      symbol: String(c?.item?.symbol ?? "").toUpperCase(),
      thumb: typeof c?.item?.thumb === "string" ? c.item.thumb : null,
      change24h: Number(c?.item?.data?.price_change_percentage_24h?.usd) || 0,
    }));
  } catch {
    return [];
  }
}

async function markets(): Promise<CoinRow[]> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&price_change_percentage=1h,24h,7d&sparkline=true",
    { headers: { accept: "application/json" }, next: { revalidate } }
  );
  if (!res.ok) throw new Error(`markets ${res.status}`);
  const data: any[] = await res.json();
  return data.map((d, i) => ({
    id: String(d.id ?? ""),
    rank: Number(d.market_cap_rank) || i + 1,
    name: String(d.name ?? "-"),
    symbol: String(d.symbol ?? "").toUpperCase(),
    image: typeof d.image === "string" ? d.image : null,
    price: Number(d.current_price) || 0,
    change1h: Number(d.price_change_percentage_1h_in_currency) || 0,
    change24h: Number(d.price_change_percentage_24h_in_currency ?? d.price_change_percentage_24h) || 0,
    change7d: Number(d.price_change_percentage_7d_in_currency) || 0,
    marketCap: Number(d.market_cap) || 0,
    volume24h: Number(d.total_volume) || 0,
    sparkline: Array.isArray(d.sparkline_in_7d?.price) ? d.sparkline_in_7d.price.filter((x: any) => Number.isFinite(x)) : [],
  }));
}

export async function GET() {
  try {
    const [list, trend] = await Promise.all([markets(), trending()]);
    const byChange = [...list].filter((r) => Number.isFinite(r.change24h)).sort((a, b) => b.change24h - a.change24h);
    const toMover = (r: CoinRow): MoverCoin => ({ id: r.id, name: r.name, symbol: r.symbol, image: r.image, price: r.price, change24h: r.change24h });
    return NextResponse.json(
      {
        list,
        trending: trend,
        gainers: byChange.slice(0, 6).map(toMover),
        losers: byChange.slice(-6).reverse().map(toMover),
        live: true,
        ts: Date.now(),
      },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } }
    );
  } catch {
    return NextResponse.json(
      { list: [], trending: [], gainers: [], losers: [], live: false, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=30" } }
    );
  }
}
