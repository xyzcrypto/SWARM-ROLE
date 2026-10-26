import { unstable_cache } from "next/cache";

// Shared, cached access to the DefiLlama endpoints this site reads.
//
// ## The problem this exists for
//
// Next's data cache rejects any response over ~2 MB. Four of our upstreams are
// far past that, and every production build said so out loud:
//
//   Failed to set Next.js data cache for https://api.llama.fi/protocols,
//     items over 2MB can not be cached (11396797 bytes)
//   Failed to set Next.js data cache for https://yields.llama.fi/pools,
//     items over 2MB can not be cached (14271767 bytes)
//   …plus overview/dexs and overview/fees
//
// The routes carried `next: { revalidate }` on those fetches, so the code read
// as though the responses were cached. They never were. The cost is not the
// download alone — it is that **11–14 MB gets re-fetched and re-`JSON.parse`d on
// every regeneration to keep about a kilobyte**, which on this plan is Fluid
// Active CPU, and that two routes wanting the same URL each paid for it
// separately (`overview/dexs` is read by both `/api/markets/dex` and
// `sitemap.ts`; `overview/derivatives` by both `/api/markets/perp` and
// `sitemap.ts`).
//
// ## What changes
//
// Cache the **reduced** value instead of the raw body. `unstable_cache` stores
// the function's return value, and these return kilobytes, so the data cache
// accepts them — the thing the `next: { revalidate }` hints were only pretending
// to do. One entry per upstream, shared by every caller.
//
// The inner fetches are explicitly `cache: "no-store"`: the body cannot be
// cached anyway, and saying so stops Next from attempting it and printing the
// warning on every build. The caching now happens one layer up, where the value
// actually fits.
//
// ## Freshness is deliberately unchanged
//
// 🔴 Each TTL must be the **LONGEST** window among that upstream's callers, and
// that is not a preference — it is forced by trap 1b in the `cost-check` skill:
// **Next takes the MINIMUM revalidate across a route segment**, and an
// `unstable_cache` TTL counts. A TTL below a caller's own `export const
// revalidate` silently becomes that route's real window.
//
// This was measured, not reasoned about. The first version of this file set
// OVERVIEW_TTL to 200 (the *shortest* caller, `/api/markets/perp`) on the theory
// that nobody should get staler data. The build output immediately disagreed:
//
//     /api/markets/dex   ≈5m  →  ≈3m
//
// `/api/markets/dex` exports 320s against a **300s client poll**. Dropping its
// effective window to 200s would have put every poll on an expired window and
// regenerated the route each time — trap 1, the expensive one — while the route
// file still read `export const revalidate = 320`. The unit test could not see
// it either; only the route table could.
//
// So OVERVIEW_TTL is 320, the longest caller (`/api/markets/dex`). The cost is
// that `/api/markets/perp` may serve derivatives figures up to 320s old rather
// than 200s. Its own route window is untouched (segment min = its own 200), and
// two minutes on a 24h volume aggregate is immaterial — whereas regenerating a
// route on every poll is not.
//
// ⚠️ `markets-poll-alignment.test.ts` now asserts each TTL is >= the largest
// window among its consumers. Read trap 1b before changing one.

/** Longest consumer window: `/api/markets/dex` (320s). */
export const OVERVIEW_TTL = 320;
/** Only consumer: `/api/markets/defi` (200s). */
export const PROTOCOLS_TTL = 200;
/** Only consumer: `/api/markets/yields` (320s). */
export const YIELDS_TTL = 320;

/** Upstream can be slow; a sitemap or a markets card must never hang on it. */
const TIMEOUT_MS = 8000;

async function getJson(url: string): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json", "user-agent": "xyzcrypto-markets/1.0" },
      // See the note above: >2 MB, so Next cannot store it. Asking it to try
      // only produces a build warning.
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${url} ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export type OverviewKind = "dexs" | "fees" | "derivatives";

/**
 * One protocol row, trimmed to the union of what every caller needs.
 *
 * `slug` and `module` stay RAW rather than normalized: `sitemap.ts` builds its
 * URLs from `slug ?? module`, while the markets routes run them through
 * `protocolSlug()`. Normalizing here would silently change the sitemap's URLs.
 */
export type OverviewRow = {
  slug: string | null;
  module: string | null;
  name: string;
  total24h: number;
  /** Longer windows, added for the points comparables engine. A single day of
   *  perp volume is noisy enough that a valuation multiple built on it says
   *  more about yesterday than about the venue. Absent on some upstream rows,
   *  in which case they read 0 and the caller must treat that as "no data"
   *  rather than "no volume". */
  total7d: number;
  total30d: number;
  /** Open interest where the upstream reports it, else 0. A level, not a flow -
   *  never annualise it. */
  openInterest: number;
  change1d: number;
  logo: string | null;
};

export type Overview = { total24h: number; protocols: OverviewRow[] };

/**
 * ⚠️ Every row is kept, in the upstream's ORIGINAL ORDER. Neither the sort nor a
 * truncation belongs here, and an earlier version of this function had both.
 *
 * `sitemap.ts` takes the first 40 rows **as the API returned them** to build
 * `/markets/protocol/<type>/<slug>` URLs. Sorting by `total24h` first quietly
 * changed which forty protocols get published — not a crash, just a different
 * sitemap than the one that was there before, which is exactly the kind of
 * change that is never noticed. Meanwhile `/api/markets/{dex,perp}` run `topBy`
 * over whatever they are given, so truncating here could have dropped a
 * high-volume protocol that happened to sit past the cut in API order.
 *
 * Keeping everything costs nothing that matters: only six fields survive, so
 * even a couple of thousand protocols is a couple of hundred KB — an order of
 * magnitude under the 2 MB ceiling this whole module exists to stay beneath,
 * and three orders under the raw body.
 */
export function reduceOverview(j: any): Overview {
  const list: any[] = Array.isArray(j?.protocols) ? j.protocols : [];
  const protocols: OverviewRow[] = list.map((p) => ({
    slug: typeof p?.slug === "string" ? p.slug : null,
    module: typeof p?.module === "string" ? p.module : null,
    name: String(p?.name ?? "-"),
    total24h: Number(p?.total24h) || 0,
    // Three more numbers per row against the ~2 MB data-cache ceiling this
    // module exists to stay under. The existing note measured the six surviving
    // fields at a couple of hundred KB for a couple of thousand protocols, so
    // three numeric fields is noise - but it is the kind of addition that
    // stops being noise if it is made repeatedly without anyone checking.
    total7d: Number(p?.total7d) || 0,
    total30d: Number(p?.total30d) || 0,
    // Upstream spells this differently across endpoints and omits it entirely
    // for most. 0 means "not reported"; callers must not read it as "zero OI".
    openInterest: Number(p?.openInterestAtEnd ?? p?.openInterest) || 0,
    change1d: Number(p?.change_1d) || 0,
    logo: typeof p?.logo === "string" ? p.logo : null,
  }));
  // Prefer the API's own aggregate; fall back to summing the list, exactly as
  // /api/markets/perp did before this moved here.
  const total24h = Number(j?.total24h) || protocols.reduce((s, p) => s + p.total24h, 0);
  return { total24h, protocols };
}

const overviewLoaders: Record<OverviewKind, () => Promise<Overview>> = {
  dexs: makeOverviewLoader("dexs"),
  fees: makeOverviewLoader("fees"),
  derivatives: makeOverviewLoader("derivatives"),
};

function makeOverviewLoader(kind: OverviewKind) {
  return unstable_cache(
    async () =>
      reduceOverview(
        await getJson(
          `https://api.llama.fi/overview/${kind}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`
        )
      ),
    ["llama", "overview", kind],
    { revalidate: OVERVIEW_TTL, tags: ["llama-overview"] }
  );
}

/** `overview/<kind>`, reduced and shared across every route that reads it. */
export function llamaOverview(kind: OverviewKind): Promise<Overview> {
  return overviewLoaders[kind]();
}

export type ProtocolRow = { name: string; tvl: number; chain: string; change1d: number; logo: string | null };

/**
 * `api.llama.fi/protocols` — 11.4 MB of every protocol with its full TVL
 * history, of which `/api/markets/defi` keeps the top 8. Reduced to 40 so a
 * future caller has headroom without another 11 MB round trip.
 */
export const llamaProtocols = unstable_cache(
  async (): Promise<ProtocolRow[]> => {
    const list: any[] = await getJson("https://api.llama.fi/protocols");
    return (Array.isArray(list) ? list : [])
      .map((p) => ({
        name: String(p?.name ?? "-"),
        tvl: Number(p?.tvl) || 0,
        chain: String(p?.chain ?? p?.chains?.[0] ?? "-"),
        change1d: Number(p?.change_1d) || 0,
        logo: typeof p?.logo === "string" ? p.logo : null,
      }))
      .sort((a, b) => b.tvl - a.tvl)
      .slice(0, 40);
  },
  ["llama", "protocols"],
  { revalidate: PROTOCOLS_TTL, tags: ["llama-protocols"] }
);

export type PoolRow = { project: string; symbol: string; chain: string; apy: number; tvl: number; logo?: string | null };

/**
 * `yields.llama.fi/pools` — 14.3 MB, of which `/api/markets/yields` keeps ten
 * rows. The TVL/APY filter runs here so the cached value stays tiny; it is the
 * same filter the route applied before.
 */
export const llamaYieldPools = unstable_cache(
  async (): Promise<PoolRow[]> => {
    const j = await getJson("https://yields.llama.fi/pools");
    const raw: any[] = Array.isArray(j?.data) ? j.data : [];
    return raw
      .filter((p) => (Number(p?.tvlUsd) || 0) >= 1_000_000 && (Number(p?.apy) || 0) < 1000)
      .map((p) => {
        const project = String(p?.project ?? "-");
        return {
          project,
          symbol: String(p?.symbol ?? "-"),
          chain: String(p?.chain ?? "-"),
          apy: Number(p?.apy) || 0,
          tvl: Number(p?.tvlUsd) || 0,
          logo: project !== "-" ? `https://icons.llamao.fi/icons/protocols/${encodeURIComponent(project.toLowerCase())}` : null,
        };
      })
      .sort((a, b) => b.apy - a.apy)
      .slice(0, 40);
  },
  ["llama", "yield-pools"],
  { revalidate: YIELDS_TTL, tags: ["llama-yields"] }
);
