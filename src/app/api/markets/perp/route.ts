import { NextResponse } from "next/server";
import { topBy, type PerpDex, type PerpMarket } from "@/lib/markets";

// Perp DEX / derivatives snapshot: top perp DEXs by 24h volume (DefiLlama,
// keyless) + top live perp markets by open interest with funding rates
// (Hyperliquid public API). Graceful always-200 `live` flag.
export const revalidate = 60;

async function perpDexs(): Promise<PerpDex[]> {
  const res = await fetch("https://api.llama.fi/overview/derivatives", {
    headers: { accept: "application/json" },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`derivatives ${res.status}`);
  const j = await res.json();
  const list: any[] = j?.protocols ?? [];
  return topBy(list, (p) => Number(p.total24h) || 0, 8).map((p: any) => ({
    name: String(p.name ?? "—"),
    volume24h: Number(p.total24h) || 0,
    change1d: Number(p.change_1d) || 0,
    logo: typeof p.logo === "string" ? p.logo : null,
  }));
}

// Hyperliquid live perp markets — funding + open interest per coin.
async function hyperliquidMarkets(): Promise<PerpMarket[]> {
  try {
    const res = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
      next: { revalidate },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const universe: any[] = data?.[0]?.universe ?? [];
    const ctxs: any[] = data?.[1] ?? [];
    const rows: PerpMarket[] = universe.map((u, i) => ({
      coin: String(u?.name ?? "—"),
      price: Number(ctxs[i]?.markPx) || 0,
      funding: Number(ctxs[i]?.funding) || 0, // hourly funding fraction
      openInterest: (Number(ctxs[i]?.openInterest) || 0) * (Number(ctxs[i]?.markPx) || 0),
    }));
    return topBy(rows, (r) => r.openInterest, 8);
  } catch {
    return [];
  }
}

export async function GET() {
  // Both halves are independent so one flaky upstream can't blank the whole tab.
  const [dexs, markets] = await Promise.all([
    perpDexs().catch(() => [] as PerpDex[]),
    hyperliquidMarkets().catch(() => [] as PerpMarket[]),
  ]);
  const live = dexs.length > 0 || markets.length > 0;
  return NextResponse.json(
    { dexs, markets, live, ts: Date.now() },
    { headers: { "Cache-Control": live ? "public, s-maxage=60, stale-while-revalidate=180" : "public, s-maxage=20" } }
  );
}
