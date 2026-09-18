import type { NewsItem } from "@modules/news/lib/news";

/**
 * The trusted-source lane of the airdrop desk.
 *
 * The desk has two lanes on purpose, and they are labelled separately because
 * they carry different authority:
 *
 * - **Posted by the desk** - written by the team, in `PointsUpdate`. Few, exact,
 *   and accountable to a person.
 * - **Picked up from trusted sources** - this file. Many, automatic, and only as
 *   good as the outlet. It is never presented as the desk's own word.
 *
 * ⚠️ No new upstream. This is a FILTER over `getNewsPage`, the site's existing
 * RSS pipeline, which is already fetched, parsed, deduped and cached for /news.
 * Adding a second fetch of the same twenty feeds would have doubled the cost of
 * something the site already pays for, and a second parser would have been a
 * second thing to keep correct - `parseFeed` has been hardened against CDATA,
 * Atom, entity escaping and malformed dates that a new one would meet fresh.
 *
 * ⚠️ X/Twitter is deliberately NOT a source. There is no free API for it any
 * more, and scraping a logged-out timeline returns something different every
 * week. Pretending to read X while actually reading an outlet that quotes X
 * would be a claim about sourcing that is not true. The desk's own posts are
 * where a specific tweet belongs, with its link.
 */

/**
 * Categories that make a story belong on a points page.
 *
 * These are `categorize()`'s own labels, not new ones - the taxonomy already
 * ships "Perp DEX", "Airdrops" and "Token Launches", so the classification is
 * the same one /news displays and there is only one place it can drift.
 */
export const RADAR_CATEGORIES = ["Airdrops", "Perp DEX", "Token Launches"] as const;

/**
 * Words that put a story on the radar even when the classifier did not.
 *
 * ⚠️ Additive only, and narrow. A broad keyword list turns a curated feed into
 * a crypto firehose, which is the failure mode of every "airdrop tracker" and
 * the reason this page exists at all. `snapshot` and `tge` are included because
 * they are the two events a farmer plans around and both are frequently written
 * without the word "airdrop" anywhere near them.
 */
const RADAR_HINTS =
  /\b(airdrop|points program|points programme|snapshot|tge|token generation|perp dex|perpetual dex|season \d|farming round)\b/i;

export type RadarItem = {
  id: string;
  title: string;
  url: string;
  summary: string;
  source: string;
  sourceIcon: string | null;
  publishedAt: number;
  category: string;
  /** Venues this story names, for the per-programme filter chips. */
  venues: string[];
};

/**
 * Venue names worth tagging a story with.
 *
 * Matched case-insensitively on word boundaries so "Aster" does not match
 * "asterisk" and "GMX" does not match a longer token. Kept short and explicit:
 * a wrong tag sends a reader to the wrong programme's section, which is worse
 * than no tag.
 */
const VENUE_PATTERNS: [string, RegExp][] = [
  ["Hyperliquid", /\bhyperliquid\b/i],
  ["Aster", /\baster\b/i],
  ["Lighter", /\blighter\b/i],
  ["Paradex", /\bparadex\b/i],
  ["edgeX", /\bedgex\b/i],
  ["Variational", /\bvariational\b/i],
  ["Sodex", /\bsodex\b/i],
  ["RiseX", /\brise ?x\b/i],
  ["dYdX", /\bdydx\b/i],
  ["GMX", /\bgmx\b/i],
  ["Jupiter", /\bjupiter\b/i],
  ["Drift", /\bdrift\b/i],
  ["Ostium", /\bostium\b/i],
  ["Pacifica", /\bpacifica\b/i],
  ["Extended", /\bextended exchange\b/i],
  ["Backpack", /\bbackpack\b/i],
];

/** Which tracked venues a story mentions. Empty is normal and fine. */
export function venuesNamed(text: string): string[] {
  const out: string[] = [];
  for (const [name, re] of VENUE_PATTERNS) if (re.test(text)) out.push(name);
  return out;
}

/** Whether a story belongs on a points page at all. */
export function isRadarWorthy(item: Pick<NewsItem, "title" | "summary" | "categories">): boolean {
  if (item.categories?.some((c) => (RADAR_CATEGORIES as readonly string[]).includes(c))) return true;
  return RADAR_HINTS.test(`${item.title} ${item.summary}`);
}

/**
 * Filter and shape the site's news items into radar items.
 *
 * ⚠️ The limit is 30, not 12. Twelve was enough for a promoted item plus a
 * folded list, but it silently decided what "everything important" meant - a
 * reader asking to see the rest got a truncation nobody mentioned. Thirty is
 * still bounded (the payload stays a few KB) and covers a full day of a feed
 * this narrow.
 *
 * Sorted newest first rather than by the news ranker: on a feed this narrow,
 * "what happened most recently" is the question, and an impact score computed
 * for general crypto news would bury a snapshot announcement under a funding
 * round.
 */
export function toRadar(items: NewsItem[], limit = 30): RadarItem[] {
  return items
    .filter(isRadarWorthy)
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, limit)
    .map((n) => ({
      id: n.id,
      title: n.title,
      url: n.url,
      summary: n.summary.slice(0, 260),
      source: n.source,
      sourceIcon: n.sourceIcon,
      publishedAt: n.publishedAt,
      category: n.category,
      venues: venuesNamed(`${n.title} ${n.summary}`),
    }));
}
