import { normaliseVenue } from "@modules/points/lib/perp-sources";

/**
 * Perp DEX venues for the Markets leaderboard, from more than one live source.
 *
 * Why not DefiLlama alone: production has shown `api.llama.fi/overview/derivatives`
 * refusing this deployment (see `perp-sources.ts`), and when it did the board
 * fell back to Hyperliquid as a single row with a 0% change. CoinGecko's
 * derivatives list has been reachable from production throughout and carries a
 * real logo, 24h volume and open interest for each venue, so it is the
 * dependable source; DefiLlama adds a 24h change when it answers, and
 * Hyperliquid's own API is authoritative for Hyperliquid.
 */

/** The board, in the owner's order (2026-10-27). Matched by normalised name. */
export const FEATURED_PERP_VENUES = [
  { key: "hyperliquid", name: "Hyperliquid", names: ["hyperliquid"], llamaSlug: null, cg: [], fallbackLogo: null },
  { key: "lighter", name: "Lighter", names: ["lighter"], llamaSlug: null, cg: [], fallbackLogo: null },
  { key: "variational", name: "Variational", names: ["variational", "variationalomni"], llamaSlug: null, cg: [], fallbackLogo: null },
  { key: "txflow", name: "TXFlow", names: ["txflow"], llamaSlug: "txflow-perps", cg: [], fallbackLogo: "https://icons.llamao.fi/icons/protocols/txflow-perps" },
  { key: "risex", name: "RiseX", names: ["risex"], llamaSlug: "risex", cg: ["risex"], fallbackLogo: "/risex-logo.png" },
  { key: "arcus", name: "Arcus", names: ["arcus"], llamaSlug: "arcus-perps", cg: ["arcus-futures"], fallbackLogo: null },
  { key: "sodex", name: "SoDEX", names: ["sodex"], llamaSlug: "sodex-perps", cg: [], fallbackLogo: null },
] as const;

/**
 * DefiLlama's per-protocol summary: a few KB, unlike the 2 MB+ overview. Used
 * only for a featured venue no other source reported (TXFlow is on DefiLlama
 * alone). Best effort: a refusal returns null and the row shows a dash.
 */
export async function llamaSummary(slug: string, revalidate: number): Promise<LlamaRow | null> {
  try {
    const res = await fetch(
      `https://api.llama.fi/summary/derivatives/${encodeURIComponent(slug)}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`,
      { headers: { accept: "application/json" }, signal: AbortSignal.timeout(6000), next: { revalidate } }
    );
    if (!res.ok) return null;
    const j = await res.json();
    const total24h = Number(j?.total24h) || 0;
    if (!(total24h > 0)) return null;
    return {
      slug,
      name: String(j?.name ?? slug),
      total24h,
      openInterest: Number(j?.openInterestAtEnd ?? j?.openInterest) || 0,
      change1d: Number(j?.change_1d),
      logo: typeof j?.logo === "string" ? j.logo : null,
    };
  } catch {
    return null;
  }
}

export type PerpVenue = {
  key: string;
  name: string;
  logo: string | null;
  volume24h: number | null;
  openInterest: number | null;
  /** Only DefiLlama publishes a 24h change; null when it did not answer. */
  change1d: number | null;
};

/** One CoinGecko derivatives-exchange row, converted to USD. */
export type CgDerivRow = { id: string; name: string; key: string; logo: string | null; volume24h: number; openInterest: number };

/**
 * CoinGecko's derivatives exchanges, ordered by 24h volume, converted from BTC
 * to USD with a spot price fetched alongside. If that price is missing the
 * whole source is dropped: BTC-denominated numbers in a USD table would be off
 * by five orders of magnitude and look entirely plausible.
 *
 * Three pages because the smaller venues (Arcus, RiseX: tens of millions a day)
 * rank behind the large CEXs. ~100 small rows a page, well under Next's 2 MB
 * data-cache ceiling, so `next: { revalidate }` genuinely caches them.
 * `revalidate` is the caller's own window (cost-check trap 1b).
 */
export async function coingeckoDerivativeRows(revalidate: number): Promise<CgDerivRow[]> {
  const opts = { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000), next: { revalidate } };
  const pages = [1, 2, 3].map((page) =>
    fetch(`https://api.coingecko.com/api/v3/derivatives/exchanges?order=trade_volume_24h_btc_desc&per_page=100&page=${page}`, opts)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
  );
  const [price, ...lists] = await Promise.all([
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd", opts)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    ...pages,
  ]);
  const btcUsd = Number(price?.bitcoin?.usd) || 0;
  if (!(btcUsd > 0)) return [];

  const rows: CgDerivRow[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const r of list) {
      const name = String(r?.name ?? "").trim();
      const volume24h = (Number(r?.trade_volume_24h_btc) || 0) * btcUsd;
      const id = String(r?.id ?? "");
      if (!name || !(volume24h > 0) || seen.has(id || name)) continue;
      seen.add(id || name);
      rows.push({
        id,
        name,
        key: normaliseVenue(name),
        logo: typeof r?.image === "string" && r.image.startsWith("https://") ? r.image : null,
        volume24h,
        openInterest: (Number(r?.open_interest_btc) || 0) * btcUsd,
      });
    }
  }
  return rows;
}

export type LlamaRow = { slug: string | null; name: string; total24h: number; openInterest: number; change1d: number; logo: string | null };

/**
 * Assemble the board. Each figure comes from a live source or is null - a venue
 * no source reports shows a dash, never an estimate.
 *
 * Precedence per field:
 * - volume: Hyperliquid's own API for Hyperliquid, else DefiLlama, else CoinGecko
 * - open interest: Hyperliquid's own API, else CoinGecko, else DefiLlama
 * - change: DefiLlama only
 * - logo: CoinGecko, else DefiLlama, else a committed asset
 */
export function buildPerpVenues(
  llama: LlamaRow[],
  cg: CgDerivRow[],
  hl: { volume24h: number; openInterest: number }
): PerpVenue[] {
  return FEATURED_PERP_VENUES.map((v) => {
    const keys = new Set<string>(v.names);
    const ll = llama.find((r) => keys.has(normaliseVenue(r.name)) || keys.has(normaliseVenue(r.slug ?? "")));
    // Several CoinGecko rows can share a venue (e.g. "Lighter" spot and
    // "Lighter (Futures)"); the derivatives list is futures-only, so take the
    // largest by volume.
    const cgHit = cg
      .filter((r) => (v.cg as readonly string[]).includes(r.id) || keys.has(r.key))
      .sort((a, b) => b.volume24h - a.volume24h)[0];
    const isHl = v.key === "hyperliquid";

    const volume24h = (isHl && hl.volume24h > 0 ? hl.volume24h : null) ?? (ll && ll.total24h > 0 ? ll.total24h : null) ?? cgHit?.volume24h ?? null;
    const openInterest =
      (isHl && hl.openInterest > 0 ? hl.openInterest : null) ??
      (cgHit && cgHit.openInterest > 0 ? cgHit.openInterest : null) ??
      (ll && ll.openInterest > 0 ? ll.openInterest : null);

    return {
      key: v.key,
      name: v.name,
      logo: cgHit?.logo ?? ll?.logo ?? v.fallbackLogo,
      volume24h,
      openInterest,
      change1d: ll && Number.isFinite(ll.change1d) && ll.total24h > 0 ? ll.change1d : null,
    };
  }).sort((a, b) => (b.volume24h ?? -1) - (a.volume24h ?? -1));
}
