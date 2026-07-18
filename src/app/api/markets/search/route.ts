import { NextResponse } from "next/server";
import type { CoinRow } from "@/lib/markets";

// Coin search (CoinGecko, keyless): finds ANY coin by name/symbol - not just the
// top 250 in the main table - and returns it with live market data. Two cached
// calls: /search to resolve matches, then /coins/markets for their prices.
// Was 60s - this route was missed in the 2026-07-17 ISR Writes audit. It's
// keyed by an arbitrary user-typed search string (high cardinality - every
// distinct query is its own Data Cache entry), the same multiplication risk
// already fixed for per-coin/per-id routes. Search results don't need
// near-real-time freshness.
export const revalidate = 300;

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (q.length < 2) {
    return NextResponse.json({ list: [], live: true, ts: Date.now() }, { headers: { "Cache-Control": "public, s-maxage=60" } });
  }
  try {
    const sres = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`, {
      headers: { accept: "application/json" },
      next: { revalidate },
    });
    if (!sres.ok) throw new Error(`search ${sres.status}`);
    const sj = await sres.json();
    const ids: string[] = (sj?.coins ?? []).slice(0, 20).map((c: { id?: string }) => String(c?.id ?? "")).filter(Boolean);
    if (!ids.length) {
      return NextResponse.json({ list: [], live: true, ts: Date.now() }, { headers: { "Cache-Control": "public, s-maxage=120" } });
    }

    const mres = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(",")}&order=market_cap_desc&price_change_percentage=1h,24h,7d&sparkline=true`,
      { headers: { accept: "application/json" }, next: { revalidate } }
    );
    if (!mres.ok) throw new Error(`markets ${mres.status}`);
    const data: Array<Record<string, unknown>> = await mres.json();
    const list: CoinRow[] = data.map((d, i) => ({
      id: String(d.id ?? ""),
      rank: Number(d.market_cap_rank) || i + 1,
      name: String(d.name ?? "-"),
      symbol: String(d.symbol ?? "").toUpperCase(),
      image: typeof d.image === "string" ? d.image : null,
      price: Number(d.current_price) || 0,
      change1h: Number(d.price_change_percentage_1h_in_currency) || 0,
      change24h: Number((d.price_change_percentage_24h_in_currency as number) ?? (d.price_change_percentage_24h as number)) || 0,
      change7d: Number(d.price_change_percentage_7d_in_currency) || 0,
      marketCap: Number(d.market_cap) || 0,
      volume24h: Number(d.total_volume) || 0,
      sparkline: Array.isArray((d.sparkline_in_7d as { price?: unknown })?.price)
        ? ((d.sparkline_in_7d as { price: unknown[] }).price as unknown[]).filter((x): x is number => Number.isFinite(x as number)) as number[]
        : [],
    }));
    return NextResponse.json({ list, live: true, ts: Date.now() }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch {
    return NextResponse.json({ list: [], live: false, ts: Date.now() }, { headers: { "Cache-Control": "public, s-maxage=30" } });
  }
}
