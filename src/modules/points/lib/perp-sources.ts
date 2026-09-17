import type { CompVenue } from "@modules/points/lib/points";

/**
 * Perp DEX activity from more than one upstream.
 *
 * ## Why this exists, with the evidence
 *
 * The comparables panel showed "Data unavailable" for three releases. Two
 * theories were wrong because nothing could see production. The stage
 * diagnostics added for exactly that purpose finally printed it:
 *
 *     venues from upstream: 0 · past the volume filter: 0 ·
 *     priced tokens: 249 · matched: 0 · llama Error
 *
 * **CoinGecko was fine - 249 tokens priced. DefiLlama was refusing.** `llama.ts`
 * throws `new Error("<url> <status>")` on a non-OK response, so `err.name` is
 * the generic "Error" and the status was thrown away by the reporting, but the
 * shape is unambiguous: the derivatives overview returned non-OK to this
 * deployment while the other host answered normally.
 *
 * One upstream being able to blank a page is the actual defect. A single source
 * is a single point of failure no amount of retrying fixes.
 *
 * ## The rule this module follows
 *
 * A second source may only ever ADD venues, and only ones it can name. An
 * unrecognised venue is dropped rather than included, because the fallback's
 * list mixes centralised exchanges in with perp DEXs, and quietly pricing a
 * points programme against Binance's volume would be the "wrong number
 * presented as right" failure this codebase keeps being bitten by. Failing
 * closed costs a few peers; failing open costs the number's credibility.
 */

/**
 * Perp DEXs, by name, for filtering a mixed venue list down to this sector.
 *
 * ⚠️ An allowlist rather than a denylist of known CEXs, deliberately. A
 * denylist admits every venue nobody has thought about yet, which is the
 * direction that silently corrupts a comparable set. This one lets through only
 * names a reader could check.
 *
 * Normalised on both sides before comparison, so spelling and case here do not
 * matter.
 */
const PERP_DEX_NAMES = [
  "hyperliquid",
  "dydx",
  "gmx",
  "jupiter",
  "vertex",
  "drift",
  "apex",
  "gains",
  "gtrade",
  "paradex",
  "aevo",
  "orderly",
  "myx",
  "avantis",
  "synfutures",
  "hibachi",
  "lighter",
  "edgex",
  "aster",
  "ostium",
  "extended",
  "pacifica",
  "variational",
  "sodex",
  "risex",
  "kwenta",
  "polynomial",
  "bluefin",
  "zeta",
  "mango",
  "levana",
  "rabbitx",
  "bsx",
  "satori",
  "helix",
  "injective",
  "perpetual",
  "intentx",
  "vela",
  "krav",
  "holdstation",
];

/**
 * Strip the decoration the registries disagree on, so one project is one key.
 *
 * ⚠️ THE ONLY normaliser. The route used to carry its own copy that did not
 * strip `futures`, and that single missing word produced the wrong numbers a
 * reader actually saw:
 *
 * CoinGecko's derivatives list names the venue **"Hyperliquid (Futures)"**. The
 * route's copy reduced that to `hyperliquidfutures`, which matches nothing in a
 * token list keyed on `hyperliquid` - so Hyperliquid came back with `fdv: null`
 * and was classified **unlisted**. The explorer auto-selects the first unlisted
 * venue, so it targeted the single largest perp DEX in existence as though it
 * had no token, and derived its "implied FDV" from the two peers that happened
 * to survive. Measured live: "12 venues · 2 with a listed token · 10 unlisted".
 *
 * Two normalisers is one normaliser and a bug waiting for a name it cannot
 * spell. Both sides import this.
 */
export function normaliseVenue(s: string): string {
  return (
    s
      .toLowerCase()
      // Anything parenthesised is a registry's qualifier, never part of the
      // project's name: "(Futures)", "(Perpetual)", "(Spot)", "(v2)".
      .replace(/\([^)]*\)/g, " ")
      .replace(
        /\b(v\d+|perpetual|perpetuals|perps?|futures|swaps?|exchange|protocol|finance|network|dex|labs|io|fi)\b/g,
        ""
      )
      .replace(/[^a-z0-9]/g, "")
      .trim()
  );
}

const PERP_SET = new Set(PERP_DEX_NAMES.map(normaliseVenue).filter(Boolean));

/** Whether a venue name is a perp DEX this module is willing to vouch for. */
export function isKnownPerpDex(name: string): boolean {
  const k = normaliseVenue(name);
  if (!k) return false;
  if (PERP_SET.has(k)) return true;
  // "Jupiter Perpetual Exchange" normalises to "jupiter"; but a name like
  // "gmxv2" can survive with a suffix, so also accept a known name as a prefix
  // when the remainder is short. Deliberately narrow: two characters, not a
  // general substring match, which would let "asterix" through as "aster".
  for (const known of PERP_SET) {
    if (k.startsWith(known) && k.length - known.length <= 2) return true;
  }
  return false;
}

type Fetched = { venues: CompVenue[]; error: string | null };

/**
 * CoinGecko's derivatives exchange list, as a fallback venue source.
 *
 * Chosen because production PROVED this host reachable in the same request that
 * showed DefiLlama failing: the token list returned 249 rows while the
 * derivatives overview returned nothing.
 *
 * ⚠️ Volumes here are denominated in BTC, not USD, so they are converted with a
 * spot price fetched alongside. If that price is missing the whole source is
 * dropped rather than emitting BTC-denominated numbers into a USD table, which
 * would be off by five orders of magnitude and look entirely plausible.
 *
 * ⚠️ `revalidate` is passed in rather than chosen here, so it always matches the
 * calling route's own window. A shorter hint inside a handler silently becomes
 * that route's real window - Next takes the minimum across a segment - which is
 * trap 1b in the cost-check skill and has shipped on this project twice.
 *
 * ⚠️ Every field is read defensively and a row that cannot produce a positive
 * USD volume is skipped. This shape has not been verified against the live API
 * from the environment this was written in, and the last time an unverified
 * upstream field was trusted it emptied the whole page. So it may add venues and
 * can never remove or gate them: a wrong guess here yields zero extra rows and a
 * diagnostic, never a wrong number.
 */
export async function coingeckoDerivatives(revalidate: number, timeoutMs = 8000): Promise<Fetched> {
  try {
    const [listRes, priceRes] = await Promise.all([
      fetch(
        "https://api.coingecko.com/api/v3/derivatives/exchanges?order=open_interest_btc_desc&per_page=100&page=1",
        // ⚠️ Cached, NOT `cache: "no-store"`. Two reasons, and the second is the
        // one that is easy to miss: this response is ~100 rows, far under Next's
        // ~2 MB data-cache ceiling, so unlike the llama overview bodies it can
        // genuinely be stored - and a single `no-store` anywhere in a segment
        // makes the WHOLE ROUTE dynamic, which turned `/api/points/comps` from a
        // prerendered ISR route back into one that runs per request. That is the
        // most expensive regression class on this project.
        { headers: { accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs), next: { revalidate } }
      ),
      fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd", {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
        next: { revalidate },
      }),
    ]);

    if (!listRes.ok) return { venues: [], error: `cg-derivatives ${listRes.status}` };
    if (!priceRes.ok) return { venues: [], error: `cg-price ${priceRes.status}` };

    const btcUsd = Number((await priceRes.json())?.bitcoin?.usd) || 0;
    if (btcUsd <= 0) return { venues: [], error: "cg-price missing btc" };

    const list = await listRes.json();
    if (!Array.isArray(list)) return { venues: [], error: "cg-derivatives shape" };

    const venues: CompVenue[] = [];
    for (const row of list) {
      const name = String(row?.name ?? "").trim();
      if (!name || !isKnownPerpDex(name)) continue;

      const volBtc = Number(row?.trade_volume_24h_btc) || 0;
      const oiBtc = Number(row?.open_interest_btc) || 0;
      const volume24h = volBtc * btcUsd;
      if (!(volume24h > 0)) continue;

      venues.push({
        slug: normaliseVenue(name) || name.toLowerCase(),
        name,
        logo: typeof row?.image === "string" ? row.image : null,
        volume24h,
        // This source publishes one day only. 0 means "not reported" and the
        // client widens to a window the venue can actually answer on rather
        // than reading it as "no volume".
        volume7d: 0,
        volume30d: 0,
        openInterest: oiBtc > 0 ? oiBtc * btcUsd : 0,
        // Filled in by the route from the token list, exactly as llama rows are.
        fdv: null,
        coingeckoId: null,
      });
    }
    return {
      venues,
      error: venues.length ? null : "cg-derivatives matched no known perp dex",
    };
  } catch (err) {
    return { venues: [], error: `cg-derivatives ${(err as Error)?.name ?? "failed"}` };
  }
}

/**
 * Merge venue lists from several sources, first source winning on a collision.
 *
 * Order is quality order: the primary source is richer (it carries 7d and 30d
 * windows), so a venue it already described is never replaced by a
 * single-window row from a fallback.
 */
export function mergeVenues(...lists: CompVenue[][]): CompVenue[] {
  const out = new Map<string, CompVenue>();
  for (const list of lists) {
    for (const v of list) {
      const key = normaliseVenue(v.name) || v.slug;
      if (!key || out.has(key)) continue;
      out.set(key, v);
    }
  }
  return [...out.values()];
}
