import { NextResponse } from "next/server";
import { topBy, protocolSlug, type DexProtocol, type FeeProtocol } from "@/lib/markets";
import { llamaOverview, type OverviewRow } from "@modules/markets/lib/llama";

// DEX + fees snapshot from DefiLlama (keyless): top DEXs by 24h spot volume and
// top protocols by 24h fees. Graceful always-200 `live` flag.
// COUPLED to the poll interval in MarketsClient.tsx: this window must be >=
// how often the client refetches, or every poll lands on an expired window
// and regenerates the route (ISR Writes + Fluid CPU). Pinned by
// src/lib/__tests__/markets-poll-alignment.test.ts - change both together.
export const revalidate = 320;

// The `overview/*` bodies are over 2 MB, so the data cache never held them
// however the fetch was hinted. `llamaOverview` caches the reduced rows instead,
// and the SAME entry serves sitemap.ts - previously each paid for its own
// download. See the note in llama.ts.
async function overview(kind: "dexs" | "fees") {
  return (await llamaOverview(kind)).protocols;
}

export async function GET() {
  try {
    const [dexRaw, feeRaw] = await Promise.all([overview("dexs"), overview("fees").catch(() => [] as OverviewRow[])]);
    const dexs: DexProtocol[] = topBy(dexRaw, (p) => p.total24h, 12).map((p) => ({
      slug: protocolSlug(p.slug ?? undefined, p.name),
      name: p.name,
      volume24h: p.total24h,
      change1d: p.change1d,
      logo: p.logo,
    }));
    const fees: FeeProtocol[] = topBy(feeRaw, (p) => p.total24h, 12).map((p) => ({
      slug: protocolSlug(p.slug ?? undefined, p.name),
      name: p.name,
      fees24h: p.total24h,
      logo: p.logo,
    }));
    return NextResponse.json(
      { dexs, fees, live: true, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=320, stale-while-revalidate=600" } }
    );
  } catch {
    return NextResponse.json(
      { dexs: [], fees: [], live: false, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=120" } }
    );
  }
}
