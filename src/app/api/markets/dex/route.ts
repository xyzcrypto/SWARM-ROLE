import { NextResponse } from "next/server";
import { topBy, protocolSlug, type DexProtocol, type FeeProtocol } from "@/lib/markets";

// DEX + fees snapshot from DefiLlama (keyless): top DEXs by 24h spot volume and
// top protocols by 24h fees. Graceful always-200 `live` flag.
export const revalidate = 300;

async function overview(kind: "dexs" | "fees") {
  const res = await fetch(
    `https://api.llama.fi/overview/${kind}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`,
    { headers: { accept: "application/json", "user-agent": "xyzcrypto-markets/1.0" }, next: { revalidate } }
  );
  if (!res.ok) throw new Error(`${kind} ${res.status}`);
  const j = await res.json();
  return (j?.protocols ?? []) as any[];
}

export async function GET() {
  try {
    const [dexRaw, feeRaw] = await Promise.all([overview("dexs"), overview("fees").catch(() => [] as any[])]);
    const dexs: DexProtocol[] = topBy(dexRaw, (p) => Number(p.total24h) || 0, 12).map((p: any) => ({
      slug: protocolSlug(p.slug, String(p.name ?? "")),
      name: String(p.name ?? "—"),
      volume24h: Number(p.total24h) || 0,
      change1d: Number(p.change_1d) || 0,
      logo: typeof p.logo === "string" ? p.logo : null,
    }));
    const fees: FeeProtocol[] = topBy(feeRaw, (p) => Number(p.total24h) || 0, 12).map((p: any) => ({
      slug: protocolSlug(p.slug, String(p.name ?? "")),
      name: String(p.name ?? "—"),
      fees24h: Number(p.total24h) || 0,
      logo: typeof p.logo === "string" ? p.logo : null,
    }));
    return NextResponse.json(
      { dexs, fees, live: true, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch {
    return NextResponse.json(
      { dexs: [], fees: [], live: false, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=120" } }
    );
  }
}
