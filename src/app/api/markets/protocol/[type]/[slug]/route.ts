import { NextResponse } from "next/server";
import { iconSrc } from "@shared/utils/img";

// Protocol summary for the Markets protocol detail page (DeFiLlama, keyless).
// `type` ∈ derivatives | dexs | fees; `slug` is sanitized to DeFiLlama's charset
// so it can't be used to reach arbitrary URLs. Cached + graceful always-200.
export const revalidate = 300;

const TYPES = new Set(["derivatives", "dexs", "fees"]);
const DATATYPE: Record<string, string> = { derivatives: "dailyVolume", dexs: "dailyVolume", fees: "dailyFees" };

function cleanSlug(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
}

export async function GET(_req: Request, props: { params: Promise<{ type: string; slug: string }> }) {
  const params = await props.params;
  const type = String(params.type || "").toLowerCase();
  const slug = cleanSlug(params.slug || "");
  if (!TYPES.has(type) || !slug) return NextResponse.json({ live: false }, { status: 200 });

  try {
    const url = `https://api.llama.fi/summary/${type}/${slug}?dataType=${DATATYPE[type]}&excludeTotalDataChartBreakdown=true`;
    const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "xyzcrypto-markets/1.0" }, next: { revalidate } });
    if (!res.ok) throw new Error(`summary ${res.status}`);
    const j: any = await res.json();

    // Keep the last ~60 daily points for a compact chart.
    const raw: any[] = Array.isArray(j?.totalDataChart) ? j.totalDataChart : [];
    const chart: number[] = raw.slice(-60).map((p: [number, number]) => Number(p?.[1]) || 0);

    const data = {
      type,
      slug,
      name: String(j?.name ?? slug),
      logo: typeof j?.logo === "string" ? iconSrc(j.logo, 96) : null,
      metric: type === "fees" ? "fees" : "volume",
      total24h: Number(j?.total24h) || 0,
      total7d: Number(j?.total7d) || 0,
      total30d: Number(j?.total30d) || 0,
      totalAllTime: Number(j?.totalAllTime) || 0,
      change1d: Number(j?.change_1d) || 0,
      change7d: Number(j?.change_7d) || 0,
      change30d: Number(j?.change_1m) || 0,
      chains: Array.isArray(j?.chains) ? j.chains.slice(0, 12).map((c: any) => String(c)) : [],
      description: String(j?.description ?? "").slice(0, 500),
      url: typeof j?.url === "string" ? j.url : null,
      chart,
      live: true,
      ts: Date.now(),
    };
    return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch {
    return NextResponse.json({ type, slug, live: false, ts: Date.now() }, { headers: { "Cache-Control": "public, s-maxage=60" } });
  }
}
