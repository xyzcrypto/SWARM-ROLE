import { normaliseVenue } from "@modules/points/lib/perp-sources";
import { iconSrc } from "@shared/utils/img";

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
  { key: "txflow", name: "TXFlow", names: ["txflow"], llamaSlug: "txflow-perps", cg: [], fallbackLogo: "/txflow-logo.png" },
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
      logo: typeof j?.logo === "string" ? iconSrc(j.logo) : null,
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
export async function coingeckoDerivativeRows(revalidate: number, btcUsdFallback?: Promise<number | null>): Promise<CgDerivRow[]> {
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
  // CoinGecko's own spot price first; Hyperliquid's BTC mark when that call was
  // refused, so one rate-limited request does not drop every venue.
  const btcUsd = Number(price?.bitcoin?.usd) || Number(btcUsdFallback ? await btcUsdFallback.catch(() => null) : 0) || 0;
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
        logo: typeof r?.image === "string" && r.image.startsWith("https://") ? iconSrc(r.image) : null,
        volume24h,
        openInterest: (Number(r?.open_interest_btc) || 0) * btcUsd,
      });
    }
  }
  return rows;
}

/**
 * True when the CoinGecko rows cover every featured venue CoinGecko lists. The
 * list is three pages; one refused page drops the smaller venues (Arcus,
 * RiseX), and a partial list must not replace a complete remembered one.
 */
export function cgCoversFeatured(rows: CgDerivRow[]): boolean {
  const viaCg = FEATURED_PERP_VENUES.filter((v) => v.key !== "hyperliquid" && v.key !== "txflow");
  return viaCg.every((v) => {
    const keys = new Set<string>(v.names);
    return rows.some((r) => (v.cg as readonly string[]).includes(r.id) || keys.has(r.key));
  });
}

export type OiRow = { name: string; slug: string | null; openInterest: number };

/**
 * DefiLlama's open-interest overview (~180 KB, free). Its `total24h` is the
 * venue's current open interest. Added because TXFlow's own Info API returns
 * empty `openInterest`/`markPx` on every instrument, and CoinGecko does not
 * list TXFlow, so its OI showed "-". The figures agree with CoinGecko's for the
 * venues both report (Lighter $398M vs $400M when checked, 2026-11-18).
 * Note DefiLlama's derivatives *volume* overview now answers 402 (paid); this
 * open-interest one does not.
 */
export async function llamaOpenInterest(revalidate: number): Promise<OiRow[]> {
  try {
    const res = await fetch(
      "https://api.llama.fi/overview/open-interest?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true",
      { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000), next: { revalidate } }
    );
    if (!res.ok) return [];
    const j = await res.json();
    const list: any[] = Array.isArray(j?.protocols) ? j.protocols : [];
    return list
      .map((p) => ({
        name: String(p?.name ?? ""),
        slug: typeof p?.slug === "string" ? p.slug : null,
        openInterest: Number(p?.total24h) || 0,
      }))
      .filter((r) => r.name && r.openInterest > 0);
  } catch {
    return [];
  }
}

export type LlamaRow = { slug: string | null; name: string; total24h: number; openInterest: number; change1d: number; logo: string | null };

export type NativeTotals = { volume24h: number; openInterest: number };

/**
 * TXFlow's own public Info API (Hyperliquid-compatible, the one app.txflow.com
 * uses). DefiLlama reads TXFlow from Dune and CoinGecko does not list it, so
 * this is the only source production can reach.
 *
 * - `perpMeta` → `universe[]`: `{ index, name, delisted? }` per perp.
 * - `webData2` → `assetCtxs[]`: one ctx per instrument, keyed by `instrumentId`
 *   (NOT array position), with `dayNtlVlm` (24h notional, USD) and, as on
 *   Hyperliquid, `openInterest` in base units and `markPx`.
 *
 * 24h volume is the sum of `dayNtlVlm` over listed perps (spot ids are not in
 * `perpMeta`). If any listed perp has no ctx, the whole figure is dropped
 * rather than reported short. Open interest is summed only where both fields
 * parse, and dropped to 0 (not reported) if any perp lacks them.
 */
export async function txflowTotals(revalidate: number): Promise<NativeTotals | null> {
  const post = (body: object) =>
    fetch("https://api.txflow.com/info", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
      next: { revalidate },
    }).then((r) => (r.ok ? r.json() : null));
  try {
    const [meta, wd] = await Promise.all([post({ type: "perpMeta", dex: "" }), post({ type: "webData2" })]);
    const universe: any[] = Array.isArray(meta?.universe) ? meta.universe : [];
    const ctxs: any[] = Array.isArray(wd?.assetCtxs) ? wd.assetCtxs : [];
    const listed = universe.filter((u) => u && u.name && u.delisted !== true && u.index != null);
    if (!listed.length || !ctxs.length) return null;

    const byId = new Map<unknown, any>();
    for (const c of ctxs) if (c && c.instrumentId != null && !byId.has(c.instrumentId)) byId.set(c.instrumentId, c);

    let volume24h = 0;
    let openInterest = 0;
    let oiComplete = true;
    for (const u of listed) {
      const c = byId.get(u.index);
      if (!c) return null;
      const v = Number(c.dayNtlVlm);
      if (!Number.isFinite(v)) return null;
      volume24h += v;
      const oi = Number(c.openInterest) * Number(c.markPx);
      if (Number.isFinite(oi)) openInterest += oi;
      else oiComplete = false;
    }
    return volume24h > 0 ? { volume24h, openInterest: oiComplete ? openInterest : 0 } : null;
  } catch {
    return null;
  }
}

/**
 * Assemble the board. Each figure comes from a live source or is null - a venue
 * no source reports shows a dash, never an estimate.
 *
 * Precedence per field:
 * - volume: the venue's own API (Hyperliquid, TXFlow), else DefiLlama, else CoinGecko
 * - open interest: the venue's own API, else CoinGecko, else DefiLlama (volume
 *   row, then its open-interest overview)
 * - change: DefiLlama only
 * - logo: CoinGecko, else DefiLlama, else a committed asset
 */
export function buildPerpVenues(
  llama: LlamaRow[],
  cg: CgDerivRow[],
  native: Partial<Record<string, NativeTotals>>,
  oi: OiRow[] = []
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
    const own = native[v.key];
    const oiHit = oi.find((r) => keys.has(normaliseVenue(r.name)) || (v.llamaSlug != null && r.slug === v.llamaSlug));

    const volume24h = (own && own.volume24h > 0 ? own.volume24h : null) ?? (ll && ll.total24h > 0 ? ll.total24h : null) ?? cgHit?.volume24h ?? null;
    const openInterest =
      (own && own.openInterest > 0 ? own.openInterest : null) ??
      (cgHit && cgHit.openInterest > 0 ? cgHit.openInterest : null) ??
      (ll && ll.openInterest > 0 ? ll.openInterest : null) ??
      (oiHit ? oiHit.openInterest : null);

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
