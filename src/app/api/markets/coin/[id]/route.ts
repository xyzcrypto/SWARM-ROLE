import { NextResponse } from "next/server";

// Single-coin snapshot for the coin detail page (CoinGecko, keyless). Cached +
// graceful always-200 (live:false on failure). Id is sanitized to CoinGecko's
// slug charset so it can't be used to reach arbitrary URLs.
// Was 60s - lengthened since this is a dynamic route (one ISR cache entry per
// coin id), so the write cost multiplies with how many distinct coins get
// traffic.
// ⚠️ 150 -> 200, and the client poll stays at 150s (CoinDetailClient).
//
// They were EQUAL, which markets-poll-alignment.test.ts calls out in its own
// words: "Exactly equal is a coin flip: the window expires at the same moment
// the poll fires, so scheduling jitter decides whether it regenerates." Every
// poll was a coin toss between a cache hit and a full CoinGecko round trip -
// on coin pages, which this route's own page comment calls the largest
// indexable surface on the site.
//
// That test never ran against this route: its target scanner only matches
// `usePolledJson<...>("/api/markets/<word>", N)`, and this is a bare fetch +
// setInterval behind a bracketed path. Coverage for exactly that gap is added
// in the same change.
export const revalidate = 200;

const BASE = "https://api.coingecko.com/api/v3";

function cleanId(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
}

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const id = cleanId(params.id || "");
  if (!id) return NextResponse.json({ live: false }, { status: 200 });

  try {
    const opts = { headers: { accept: "application/json" }, next: { revalidate } } as const;
    const [coinRes, chartRes] = await Promise.all([
      fetch(`${BASE}/coins/${id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`, opts),
      fetch(`${BASE}/coins/${id}/market_chart?vs_currency=usd&days=7`, opts),
    ]);
    if (!coinRes.ok) throw new Error(`coin ${coinRes.status}`);
    const j: any = await coinRes.json();
    const md = j?.market_data ?? {};

    const chart: number[] = chartRes.ok
      ? ((await chartRes.json())?.prices ?? []).map((p: [number, number]) => Number(p?.[1]) || 0).filter((n: number) => n > 0)
      : [];

    const descRaw = String(j?.description?.en ?? "").replace(/<[^>]+>/g, "").trim();
    const data = {
      id,
      name: String(j?.name ?? id),
      symbol: String(j?.symbol ?? "").toUpperCase(),
      image: j?.image?.large ?? j?.image?.small ?? null,
      rank: Number(md.market_cap_rank ?? j?.market_cap_rank) || null,
      price: Number(md.current_price?.usd) || 0,
      change1h: Number(md.price_change_percentage_1h_in_currency?.usd) || 0,
      change24h: Number(md.price_change_percentage_24h_in_currency?.usd ?? md.price_change_percentage_24h) || 0,
      change7d: Number(md.price_change_percentage_7d_in_currency?.usd) || 0,
      change30d: Number(md.price_change_percentage_30d_in_currency?.usd) || 0,
      marketCap: Number(md.market_cap?.usd) || 0,
      volume24h: Number(md.total_volume?.usd) || 0,
      high24h: Number(md.high_24h?.usd) || 0,
      low24h: Number(md.low_24h?.usd) || 0,
      ath: Number(md.ath?.usd) || 0,
      athChange: Number(md.ath_change_percentage?.usd) || 0,
      atl: Number(md.atl?.usd) || 0,
      circulatingSupply: Number(md.circulating_supply) || 0,
      totalSupply: Number(md.total_supply) || 0,
      maxSupply: Number(md.max_supply) || 0,
      homepage: (j?.links?.homepage ?? []).find((u: string) => u) || null,
      description: descRaw ? descRaw.slice(0, 500) : "",
      chart,
      live: true,
      ts: Date.now(),
    };
    return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=200, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ id, live: false, ts: Date.now() }, { headers: { "Cache-Control": "public, s-maxage=30" } });
  }
}
