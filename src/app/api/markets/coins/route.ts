import { NextResponse } from "next/server";
import { dedupeTrending } from "@modules/markets/lib/markets";
import type { TrendingCoin, MoverCoin, CoinRow } from "@/lib/markets";
import { lastGood } from "@modules/markets/lib/last-good";
import { thinSparkline } from "@modules/markets/lib/timeseries";
import { iconSrc } from "@shared/utils/img";

// Coins snapshot (CoinGecko, keyless): a top-250 market table (price, 1h/24h/7d
// %, mcap, volume, 7d sparkline) + trending + 24h gainers/losers, all derived from
// one markets call. Graceful always-200 `live` flag. (For coins beyond the top
// 250, the /api/markets/search route looks up any coin on demand.)
// Was 45s - lengthened along with the other markets routes to stay well under
// Vercel's free-tier ISR Writes quota.
// COUPLED to the poll interval in MarketsClient.tsx: this window must be >=
// how often the client refetches, or every poll lands on an expired window
// and regenerates the route (ISR Writes + Fluid CPU). Pinned by
// src/lib/__tests__/markets-poll-alignment.test.ts - change both together.
export const revalidate = 200;

/** A number from CoinGecko's trending payload, which mixes numbers and "$1,234.5" strings. */
function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.eE-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function trending(list: CoinRow[] = []): Promise<TrendingCoin[]> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/search/trending", {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      // Must not be SHORTER than the route's `revalidate` above: Next takes the
      // MINIMUM across the segment, so a low hint here silently governs the whole
      // route's ISR window regardless of the export.
      next: { revalidate },
    });
    if (!res.ok) return [];
    const j = await res.json();
    const rows: TrendingCoin[] = (j?.coins ?? []).slice(0, 10).map((c: any) => {
      const id = String(c?.item?.id ?? "");
      const symbol = String(c?.item?.symbol ?? "").toUpperCase();
      // Match on the CoinGecko id only. Matching on symbol let any trending token
      // that shares a ticker (there are several "BTC"s) borrow Bitcoin's price.
      const matched = list.find((m) => m.id === id);
      const price = matched ? matched.price : num(c?.item?.data?.price);
      const change24h = matched ? matched.change24h : Number(c?.item?.data?.price_change_percentage_24h?.usd) || 0;
      // `data.total_volume` arrives formatted ("$1,234,567"), so strip it to digits.
      const volume = matched ? matched.volume24h : num(c?.item?.data?.total_volume);
      const sparkline = matched?.sparkline && matched.sparkline.length > 0
        ? matched.sparkline
        : Array.isArray(c?.item?.data?.sparkline)
          ? c.item.data.sparkline
          : [];
      return {
        id,
        name: String(c?.item?.name ?? "-"),
        symbol,
        // The markets list carries the canonical logo; `item.thumb` is a 25px
        // thumbnail that renders blurry or wrong at row size.
        thumb: iconSrc(matched?.image || (typeof c?.item?.large === "string" ? c.item.large : null) || (typeof c?.item?.thumb === "string" ? c.item.thumb : null)),
        change24h,
        price,
        volume,
        sparkline,
        // CoinGecko's own 7-day sparkline image for this coin - real data, used
        // when the coin is outside the top-250 list that carries a price series.
        sparklineUrl:
          typeof c?.item?.data?.sparkline === "string" && c.item.data.sparkline.startsWith("https://")
            ? c.item.data.sparkline
            : null,
      };
    });

    return dedupeTrending(rows, list).slice(0, 8);
  } catch {
    return [];
  }
}

async function markets(): Promise<CoinRow[]> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&price_change_percentage=1h,24h,7d&sparkline=true",
    { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10_000), next: { revalidate } }
  );
  if (!res.ok) throw new Error(`markets ${res.status}`);
  const data: any[] = await res.json();
  return data.map((d, i) => ({
    id: String(d.id ?? ""),
    rank: Number(d.market_cap_rank) || i + 1,
    name: String(d.name ?? "-"),
    symbol: String(d.symbol ?? "").toUpperCase(),
    image: typeof d.image === "string" ? iconSrc(d.image) : null,
    price: Number(d.current_price) || 0,
    change1h: Number(d.price_change_percentage_1h_in_currency) || 0,
    change24h: Number(d.price_change_percentage_24h_in_currency ?? d.price_change_percentage_24h) || 0,
    change7d: Number(d.price_change_percentage_7d_in_currency) || 0,
    marketCap: Number(d.market_cap) || 0,
    volume24h: Number(d.total_volume) || 0,
    // Already in this response and previously thrown away - `/coins/markets`
    // returns `ath` and `ath_change_percentage` on every row, so "how far below
    // its all-time high" costs no extra request. The coin detail route has read
    // the same two fields all along.
    ath: Number(d.ath) || 0,
    athChange: Number(d.ath_change_percentage) || 0,
    sparkline: Array.isArray(d.sparkline_in_7d?.price) ? thinSparkline(d.sparkline_in_7d.price) : [],
    spark24h: Array.isArray(d.sparkline_in_7d?.price)
      ? d.sparkline_in_7d.price.filter((x: any) => Number.isFinite(x)).slice(-24).map((x: number) => Number(x.toPrecision(6)))
      : [],
  }));
}

export async function GET() {
  try {
    // Remembered while good (last-good.ts) so a rate-limited CoinGecko call
    // serves the previous table for up to 30 minutes instead of an empty one.
    const list = await lastGood("coins:markets", markets, { isGood: (v) => v.length > 0, maxAgeMs: 30 * 60_000 });
    const trend = await lastGood("coins:trending", () => trending(list), { isGood: (v) => v.length > 0, maxAgeMs: 2 * 60 * 60_000 });
    const byChange = [...list].filter((r) => Number.isFinite(r.change24h)).sort((a, b) => b.change24h - a.change24h);
    const toMover = (r: CoinRow): MoverCoin => ({
      id: r.id,
      name: r.name,
      symbol: r.symbol,
      image: r.image,
      price: r.price,
      change24h: r.change24h,
      volume: r.volume24h,
      sparkline: r.sparkline,
    });
    return NextResponse.json(
      {
        list,
        trending: trend,
        gainers: byChange.slice(0, 6).map(toMover),
        losers: byChange.slice(-6).reverse().map(toMover),
        live: true,
        ts: Date.now(),
      },
      { headers: { "Cache-Control": "public, s-maxage=200, stale-while-revalidate=300" } }
    );
  } catch {
    return NextResponse.json(
      { list: [], trending: [], gainers: [], losers: [], live: false, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=30" } }
    );
  }
}
