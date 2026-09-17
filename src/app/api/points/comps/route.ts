import { NextResponse } from "next/server";
import { llamaOverview, reduceOverview, type OverviewRow } from "@modules/markets/lib/llama";
import { protocolSlug } from "@/lib/markets";
import type { CompVenue } from "@modules/points/lib/points";

/**
 * Live comparables for the points valuation engine.
 *
 * Joins perp DEX activity (DefiLlama derivatives overview, keyless) with token
 * valuations (CoinGecko) so an unlisted venue's FDV can be derived from peers
 * instead of guessed. Both sources are independent: if CoinGecko is down the
 * table still renders with volumes and no FDVs, which degrades to "we cannot
 * estimate right now" rather than to a wrong estimate.
 *
 * ⚠️ WINDOW: pinned to OVERVIEW_TTL, not chosen freely. `llamaOverview` is an
 * `unstable_cache` shared with /api/markets/{perp,dex} and sitemap.ts, and Next
 * takes the MINIMUM revalidate across a segment - so a longer window here would
 * be silently truncated to the shared TTL and the route table would disagree
 * with this file (cost-check skill, trap 1b).
 *
 * ⚠️ The 320 below is a LITERAL because Next only statically analyses segment
 * config exports - `export const revalidate = OVERVIEW_TTL` builds with
 * "Invalid segment configuration export" and the value is never applied. So the
 * two numbers can now drift silently, which is exactly the shape of trap 1b;
 * `points-comps-window.test.ts` fails if they stop matching.
 *
 * ⚠️ NOT POLLED. The client fetches once on mount plus an explicit refresh
 * button, so this is deliberately absent from `TARGETS` in
 * markets-poll-alignment.test.ts. **If a poll is ever added, add it there** -
 * that test is the only thing standing between a poll and an ISR-write bill.
 */
export const revalidate = 320; // must equal OVERVIEW_TTL - pinned by a test

/**
 * Perp DEXs worth comparing against. Below this, volume is too thin to anchor on.
 *
 * ⚠️ Keyed on 24h volume, NOT 30d, and that is the whole point of this comment.
 *
 * The first version filtered and sorted on `total30d` - a field added to
 * `OverviewRow` speculatively, from an API this environment cannot reach to
 * verify. When the upstream does not return it, every row reads 0, EVERY VENUE
 * IS FILTERED OUT, and the page says "Data unavailable" with nothing anywhere
 * explaining why. That is exactly what shipped.
 *
 * `total24h` is the field `/api/markets/perp` has been using in production for
 * months, so it is the one field here that is known to exist. Longer windows
 * are treated as OPTIONAL ENRICHMENT: present, they unlock the 7d/30d metrics;
 * absent, the engine still works on 24h.
 *
 * The rule this encodes: an unverified field may add capability, never gate it.
 */
const MIN_VOLUME_24H = 2_000_000;
const MAX_VENUES = 40;

/**
 * DefiLlama protocol name -> CoinGecko coin name, for the cases where the two
 * registries spell the same project differently.
 *
 * ⚠️ Deliberately NOT a map of CoinGecko *ids*. An id is unverifiable by
 * reading it - `aster-2` vs `aster` looks equally plausible either way, and a
 * wrong one silently attaches another project's multi-billion FDV to a venue,
 * which is exactly the class of wrong-number-presented-as-right this codebase
 * has been bitten by before. Matching on NAME means a mismatch produces no FDV
 * (visible, honest) instead of someone else's (invisible, wrong).
 *
 * Keys and values are both normalised before comparison, so casing and
 * punctuation here do not matter.
 */
const NAME_ALIASES: Record<string, string> = {
  "jupiter perpetual exchange": "jupiter",
  "jupiter perps": "jupiter",
  "dydx v4": "dydx",
  "gmx v1": "gmx",
  "gmx v2": "gmx",
  "vertex protocol": "vertex protocol",
  "drift trade": "drift protocol",
  "apex protocol": "apex protocol",
  "gains network": "gains network",
};

const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(v\d+|perpetual|perpetuals|perps?|exchange|protocol|finance|network|dex)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();

type Priced = { name: string; fdv: number; id: string };

/**
 * Top tokens with a fully diluted valuation.
 *
 * One page of 250 is deliberate: a perp DEX too small to appear in the top 250
 * by market cap is too illiquid for its multiple to mean anything, so paging
 * further would add cost and noise in equal measure.
 */
async function pricedTokens(): Promise<{ rows: Priced[]; error: string | null }> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false",
      {
        next: { revalidate },
        headers: { accept: "application/json" },
        // ⚠️ This fetch had NO timeout. `llama.ts` has had one for months
        // precisely because "upstream can be slow; a card must never hang on
        // it" - and CoinGecko rate-limits shared cloud IPs hard. A hang here
        // does not degrade the page, it kills the whole route: both fetches sit
        // in one Promise.all, so the function runs to its platform timeout and
        // the client sees nothing at all.
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return { rows: [], error: `coingecko ${res.status}` };
    const j: any[] = await res.json();
    if (!Array.isArray(j)) return { rows: [], error: "coingecko shape" };
    const rows = j
      .map((c) => ({
        name: String(c?.name ?? ""),
        id: String(c?.id ?? ""),
        // Fall back to market cap only when FDV is genuinely absent: for a
        // fully-circulating token the two are equal, and dropping the row
        // instead would silently remove valid peers.
        fdv: Number(c?.fully_diluted_valuation ?? c?.market_cap) || 0,
      }))
      .filter((c) => c.name && c.fdv > 0);
    return { rows, error: null };
  } catch (err) {
    return { rows: [], error: `coingecko ${(err as Error)?.name ?? "failed"}` };
  }
}

/**
 * The shared `llamaOverview` cache, with a direct retry when it yields nothing.
 *
 * ⚠️ An empty protocol list is not a valid answer for this route - it is the
 * difference between a working page and "Data unavailable" - so it is worth one
 * uncached attempt before giving up. The shared loader is used by four other
 * surfaces and cannot be made to retry on their behalf.
 */
async function derivatives(): Promise<{ protocols: OverviewRow[]; error: string | null }> {
  try {
    const { protocols } = await llamaOverview("derivatives");
    if (protocols.length) return { protocols, error: null };
  } catch (err) {
    // Fall through to the direct attempt rather than returning here: a cached
    // failure and a live endpoint are indistinguishable from the caller's side.
    void err;
  }
  try {
    const res = await fetch(
      "https://api.llama.fi/overview/derivatives?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true",
      {
        cache: "no-store",
        headers: { accept: "application/json", "user-agent": "xyzcrypto-points/1.0" },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return { protocols: [], error: `llama ${res.status}` };
    // ⚠️ Through `reduceOverview`, the SAME normaliser the cached path uses.
    // Returning the raw rows here meant the two paths handed the caller
    // different shapes: raw spells open interest `openInterestAtEnd` (so it read
    // 0), and `name` is not guaranteed to be a string, so `p.name.toLowerCase()`
    // below could throw and turn a partial outage into a 500 - which the client
    // renders as "Data unavailable", indistinguishable from the upstream being
    // down. A fallback that behaves differently from the path it replaces is not
    // a fallback.
    const { protocols } = reduceOverview(await res.json());
    return { protocols, error: protocols.length ? null : "llama returned 0 protocols" };
  } catch (err) {
    return { protocols: [], error: `llama ${(err as Error)?.name ?? "failed"}` };
  }
}

export async function GET() {
  const [deriv, priced] = await Promise.all([derivatives(), pricedTokens()]);

  const byName = new Map<string, Priced>();
  for (const p of priced.rows) {
    const k = normalise(p.name);
    // First writer wins: the list arrives in market-cap order, so a collision
    // resolves to the larger, better-known token rather than the last one seen.
    if (k && !byName.has(k)) byName.set(k, p);
  }

  const venues: CompVenue[] = deriv.protocols
    .filter((p) => (Number(p.total24h) || 0) >= MIN_VOLUME_24H)
    .sort((a, b) => (Number(b.total24h) || 0) - (Number(a.total24h) || 0))
    .slice(0, MAX_VENUES)
    .map((p) => {
      const alias = NAME_ALIASES[String(p.name ?? "").toLowerCase()];
      const match = byName.get(normalise(alias ?? p.name));
      return {
        slug: protocolSlug(p.slug ?? undefined, p.name),
        name: p.name,
        logo: p.logo ?? null,
        volume24h: Number(p.total24h) || 0,
        volume7d: Number(p.total7d) || 0,
        volume30d: Number(p.total30d) || 0,
        openInterest: Number(p.openInterest) || 0,
        fdv: match?.fdv ?? null,
        coingeckoId: match?.id ?? null,
      };
    });

  // `live` is about the volume side only. FDVs can be entirely absent (a
  // CoinGecko outage) and the page still has something true to show.
  const live = venues.length > 0;
  const pricedCount = venues.filter((v) => v.fdv !== null).length;
  // Which comparison windows the upstream actually populated this time. The
  // client offers only these, so a metric can never render an empty table and
  // look broken when the truth is "nobody publishes that".
  const windows = {
    volume24h: venues.some((v) => v.volume24h > 0),
    volume7d: venues.some((v) => v.volume7d > 0),
    volume30d: venues.some((v) => v.volume30d > 0),
    openInterest: venues.some((v) => v.openInterest > 0),
  };

  // ⚠️ Diagnosis, not decoration. This route failed in production with the page
  // saying only "Data unavailable", and there was no way from the outside to
  // tell whether the upstream was down, the response was a different shape, or
  // the filter had dropped everything. One wrong guess about the cause already
  // shipped. Counts at each stage make the next answer a fact.
  //
  // Nothing here is sensitive: list sizes and a short upstream status.
  const diag = {
    protocols: deriv.protocols.length,
    afterFilter: venues.length,
    pricedTokens: priced.rows.length,
    matched: pricedCount,
    upstream: [deriv.error, priced.error].filter(Boolean).join("; ") || null,
  };

  return NextResponse.json(
    { venues, live, pricedCount, windows, diag, ts: Date.now() },
    {
      headers: {
        "Cache-Control": live
          ? `public, s-maxage=${revalidate}, stale-while-revalidate=${revalidate + 100}`
          : "public, s-maxage=30",
      },
    }
  );
}
