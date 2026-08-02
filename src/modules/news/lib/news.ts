// Live Web3 news - pure helpers (RSS/Atom parsing, classification, dedupe,
// time-ago). Client-safe (no server imports) and unit-tested; the /api/news
// route fetches the feeds and runs raw items through here.

export type Sentiment = "bullish" | "bearish" | "neutral";
export type Impact = "Low" | "Medium" | "High";

export type NewsItem = {
  id: string;
  title: string;
  url: string;
  summary: string;
  source: string;
  sourceIcon: string | null;
  image: string | null;
  publishedAt: number; // ms epoch
  category: string; // primary
  categories: string[];
  sentiment: Sentiment;
  impact: Impact;
  tokens: string[];
};

export type RawItem = { title: string; url: string; summary: string; image: string | null; publishedAt: number };

// The full category taxonomy shown in the UI (first is the catch-all default).
export const CATEGORIES = [
  "Breaking News", "Market News", "Bitcoin", "Ethereum", "Altcoins",
  "Layer 1", "Layer 2", "AI", "DePIN", "RWA", "DeFi", "Perp DEX",
  "Stablecoins", "NFTs", "GameFi", "SocialFi", "Security & Exploits", "Hacks",
  "Regulations", "Airdrops", "Funding Rounds", "Partnerships", "Mainnet Launches",
  "Token Launches", "Exchange Listings", "Governance Proposals", "Tech", "Science",
] as const;

// Keyword → category. First match wins for the *primary* category; all matches
// populate `categories` (for filtering).
const CATEGORY_KEYWORDS: [string, RegExp][] = [
  ["Hacks", /\b(hack|hacked|exploit|exploited|drained|stolen|rug ?pull|breach)\b/i],
  ["Security & Exploits", /\b(vulnerabilit|security flaw|phishing|malware|scam)\b/i],
  ["Regulations", /\b(sec\b|regulat|lawsuit|court|sued|ban\b|banned|compliance|cftc|mica|legal)\b/i],
  ["Airdrops", /\bairdrop/i],
  ["Funding Rounds", /\b(raise[sd]?|raising|funding round|series [a-c]|seed round|venture|\$\d+ ?(m|million|b|billion) (raise|round|funding))\b/i],
  ["Partnerships", /\bpartnership|partners with|teams up|collaborat/i],
  ["Mainnet Launches", /\bmainnet/i],
  ["Token Launches", /\b(token launch|tge\b|token generation|new token|launches token)\b/i],
  ["Exchange Listings", /\b(lists?|listing|listed on)\b.*\b(binance|coinbase|kraken|okx|bybit|upbit|exchange)\b/i],
  ["Governance Proposals", /\b(governance|proposal|dao vote|on-chain vote|votes on)\b/i],
  ["Perp DEX", /\b(perp|perpetual|derivatives|hyperliquid|dydx|gmx|open interest|funding rate)\b/i],
  ["Stablecoins", /\b(stablecoin|usdt|usdc|tether|dai\b|pyusd|pegged)\b/i],
  ["NFTs", /\b(nft|opensea|blur\b|collectible|pfp)\b/i],
  ["GameFi", /\b(gamefi|play.?to.?earn|gaming|game\b)\b/i],
  ["SocialFi", /\b(socialfi|social token|friend.?tech|lens protocol)\b/i],
  ["DePIN", /\b(depin|decentralized physical|render network|helium|iotex)\b/i],
  ["RWA", /\b(rwa|real.?world asset|tokenized (treasur|bond|stock|real estate))\b/i],
  ["AI", /\b(\bai\b|artificial intelligence|agent|llm|gpt|machine learning)\b/i],
  ["Layer 2", /\b(layer.?2|l2\b|rollup|arbitrum|optimism|\bbase\b|zksync|starknet|scroll|linea)\b/i],
  ["Layer 1", /\b(layer.?1|l1\b|solana|avalanche|cardano|polkadot|cosmos|near\b|aptos|sui\b|ton\b)\b/i],
  ["DeFi", /\b(defi|dex\b|lending|yield|liquidity|tvl|aave|uniswap|curve|maker)\b/i],
  ["Ethereum", /\b(ethereum|\beth\b|vitalik|erc-?20|dencun|pectra)\b/i],
  ["Bitcoin", /\b(bitcoin|\bbtc\b|satoshi|halving|ordinals)\b/i],
  ["Altcoins", /\b(altcoin|\bxrp\b|\bdoge|\bshib|\bada\b|\bbnb\b|memecoin|meme coin)\b/i],
  // Non-crypto buckets - low priority (crypto keywords above win the primary),
  // so general tech/science stories from those feeds classify sensibly.
  ["Science", /\b(science|scientist|research(ers)?|study|nasa|spacex|space|astronom|physics|quantum|biotech|genome|climate|energy|fusion|neuroscience)\b/i],
  ["Tech", /\b(tech|technology|software|hardware|startup|gadget|smartphone|iphone|android|apple|google|microsoft|chip|semiconductor|robot|\bev\b|electric vehicle|app\b|cybersecurity)\b/i],
];

const BULLISH = /\b(?:surg|soar|rall|jump|gain|pump|rocket|breakout|approv|adopt|upgrad|explod|bullish)\w*|\b(?:ath|record high|all.?time high)\b/i;
const BEARISH = /\b(?:plung|crash|drop|dump|slump|tank|hack|exploit|lawsuit|sued|liquidat|selloff|bearish|collaps|fear)\w*|\b(?:ban|banned|sell-?off)\b/i;
const HIGH_IMPACT = /\b(?:hack|exploit|approv|collaps|delist|lawsuit|billion|halving|mainnet)\w*|\b(?:sec|etf|ban|banned)\b/i;
const MED_IMPACT = /\b(?:launch|partner|fund|rais|listing|upgrad|proposal|integrat)\w*|\bmillion\b/i;

// Common tokens for the "related tokens" chips.
const TOKENS: [string, RegExp][] = [
  ["BTC", /\b(bitcoin|btc)\b/i], ["ETH", /\b(ethereum|eth)\b/i], ["SOL", /\b(solana|sol)\b/i],
  ["XRP", /\bxrp\b|ripple/i], ["BNB", /\bbnb\b|binance coin/i], ["DOGE", /\bdoge/i],
  ["ADA", /\bcardano|ada\b/i], ["AVAX", /\bavalanche|avax\b/i], ["LINK", /\bchainlink|link\b/i],
  ["MATIC", /\bpolygon|matic\b/i], ["DOT", /\bpolkadot|dot\b/i], ["ARB", /\barbitrum|arb\b/i],
  ["OP", /\boptimism\b/i], ["SUI", /\bsui\b/i], ["APT", /\baptos|apt\b/i], ["TON", /\bton\b|toncoin/i],
  ["USDT", /\btether|usdt\b/i], ["USDC", /\busdc\b/i], ["HYPE", /\bhyperliquid|hype\b/i],
];

/** All categories that match; the primary is the first keyword hit (or Market News). */
export function categorize(text: string): { primary: string; all: string[] } {
  if (/\bbreaking\b/i.test(text)) {
    const rest = CATEGORY_KEYWORDS.filter(([, re]) => re.test(text)).map(([c]) => c);
    return { primary: "Breaking News", all: ["Breaking News", ...rest] };
  }
  const all = CATEGORY_KEYWORDS.filter(([, re]) => re.test(text)).map(([c]) => c);
  const primary = all[0] ?? "Market News";
  return { primary, all: all.length ? all : ["Market News"] };
}

export function sentiment(text: string): Sentiment {
  const bull = BULLISH.test(text);
  const bear = BEARISH.test(text);
  if (bull && !bear) return "bullish";
  if (bear && !bull) return "bearish";
  return "neutral";
}

export function impact(text: string): Impact {
  if (HIGH_IMPACT.test(text)) return "High";
  if (MED_IMPACT.test(text)) return "Medium";
  return "Low";
}

/**
 * Rank stories so IMPORTANT news surfaces first while staying fresh: each story's
 * "adjusted age" = its real age minus an impact head-start (High ≈ 8h, Medium ≈ 3h).
 * So recent breaking/high-impact floats to the top, but an old big story still
 * sinks below genuinely newer ones. Pure + non-mutating (`now` injected for tests).
 */
// A feed that stamps a story in the future is stating something impossible, so
// the timestamp is not usable. Small skew is normal (publisher clocks, timezone
// handling), so allow a little slack before treating it as broken.
const FUTURE_TOLERANCE_MS = 6 * 60 * 60 * 1000;
// What a broken timestamp is ranked as instead. It has to be a real age, not
// zero - see below.
const UNTRUSTED_DATE_AGE_HOURS = 48;

export function rankNews<T extends { impact: Impact; publishedAt: number }>(items: T[], now: number): T[] {
  const boostHours: Record<Impact, number> = { High: 8, Medium: 3, Low: 0 };
  const score = (i: T) => {
    // `Math.max(0, ...)` used to clamp the age of a FUTURE-dated story to 0,
    // which handed it the maximum possible score for its impact tier - and kept
    // handing it that on every single re-rank, because the date stayed in the
    // future. One story with a bad timestamp pinned itself to the top of the
    // feed indefinitely. That is the "yeh story hatti hi nahi" report.
    //
    // Note `timeAgo()` a few lines down ALREADY refuses to render these
    // (`ms > now + 60_000` -> "recently"). The guard existed; the function that
    // decides ordering just did not have it.
    //
    // Clamping to `now` instead would not fix it either: the story would score
    // as brand new on every pass, for ever. It has to be given a real, finite
    // age so normal decay applies - visible, but unable to camp at rank 1.
    const untrusted = i.publishedAt > now + FUTURE_TOLERANCE_MS;
    const ageHours = untrusted
      ? UNTRUSTED_DATE_AGE_HOURS
      : Math.max(0, (now - i.publishedAt) / 3_600_000);
    return boostHours[i.impact] - ageHours; // higher = show earlier
  };
  return [...items].sort((a, b) => score(b) - score(a));
}

export function relatedTokens(text: string): string[] {
  const out: string[] = [];
  for (const [sym, re] of TOKENS) if (re.test(text) && !out.includes(sym)) out.push(sym);
  return out.slice(0, 5);
}

/** "just now" / "3 min ago" / "2 h ago" / "4 d ago". */
export function timeAgo(ms: number, now: number): string {
  // Guard against missing/garbage timestamps (0 = unparseable) and clock skew
  // that would otherwise render "20000 d ago" or a negative age.
  if (!ms || ms <= 0 || ms > now + 60_000) return "recently";
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return `${d} d ago`;
}

/**
 * Parse a feed date into ms epoch, tolerant of the formats `Date.parse` alone
 * trips on. Returns 0 only when genuinely unparseable. Robust parsing matters:
 * the API drops items with `publishedAt === 0`, so a format miss silently hides
 * fresh stories (the "latest news isn't showing" bug) and skews "x min ago".
 */
export function parseDate(input: string): number {
  const s = (input || "").trim();
  if (!s) return 0;
  // "YYYY-MM-DD HH:MM:SS" (space instead of "T", no zone) → assume UTC FIRST,
  // before Date.parse. On some runtimes/platforms Date.parse() accepts this
  // format and interprets it as **local time**, which makes the test fail when
  // the machine is not in UTC (e.g. IST = UTC+5:30).
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s) && !/[zZ]|[+-]\d\d:?\d\d$/.test(s)) {
    const t = Date.parse(s.replace(" ", "T") + "Z");
    if (Number.isFinite(t)) return t;
  }
  let t = Date.parse(s);
  if (Number.isFinite(t)) return t;
  // Last resort: strip a trailing "(UTC)"/timezone name some feeds append.
  t = Date.parse(s.replace(/\s*\([^)]*\)\s*$/, "").trim());
  return Number.isFinite(t) ? t : 0;
}

// --- RSS/Atom parsing (regex-based; robust to the common feed shapes) ---

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)));
}

function stripHtml(s: string): string {
  // Pull CDATA content out FIRST - otherwise the `<![CDATA[…]]>` wrapper looks
  // like an HTML tag and its content gets stripped. Then remove real tags.
  const noCdata = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  const noTags = noCdata.replace(/<[^>]+>/g, " ");
  return decodeEntities(noTags).replace(/\s+/g, " ").trim();
}

function tag(block: string, name: string): string | null {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(block);
  return m ? m[1].trim() : null;
}

function firstUrlAttr(block: string, tags: string[]): string | null {
  for (const t of tags) {
    const m = new RegExp(`<${t}[^>]*\\b(?:url|href)\\s*=\\s*["']([^"']+)["']`, "i").exec(block);
    if (m) return m[1];
  }
  return null;
}

/** Parse an RSS 2.0 or Atom feed into raw items (best-effort, tolerant). */
export function parseFeed(xml: string): RawItem[] {
  if (!xml) return [];
  const isAtom = /<entry[\s>]/i.test(xml) && !/<item[\s>]/i.test(xml);
  const blockRe = isAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi;
  const blocks = xml.match(blockRe) ?? [];
  const items: RawItem[] = [];
  for (const b of blocks) {
    const title = stripHtml(tag(b, "title") ?? "");
    if (!title) continue;
    let url = tag(b, "link") ?? "";
    if (isAtom || !url) {
      const href = /<link[^>]*\bhref\s*=\s*["']([^"']+)["']/i.exec(b);
      if (href) url = href[1];
    }
    url = decodeEntities(url.trim());
    const rawSummary = tag(b, "description") ?? tag(b, "summary") ?? tag(b, "content") ?? "";
    const summary = stripHtml(rawSummary).slice(0, 260);
    // Order matters, and `updated` is deliberately LAST.
    //
    // In Atom, `<updated>` is *last modified*, not published - and plenty of
    // CMSs bump it every time the entry is regenerated. Reading it as a publish
    // date means the story's timestamp rolls forward on every fetch, so it
    // renders as "just now" indefinitely and never stops being the newest thing
    // in the feed. It used to be tried before `dc:date`, i.e. a moving
    // last-modified beat a stable publication date.
    const dateStr =
      tag(b, "pubDate") ?? tag(b, "published") ?? tag(b, "dc:date") ?? tag(b, "updated") ?? "";
    const publishedAt = parseDate(dateStr);
    const image = firstUrlAttr(b, ["media:content", "media:thumbnail", "enclosure"]);
    if (url) items.push({ title, url, summary, image, publishedAt });
  }
  return items;
}

// Headline filler. The old key filtered on `w.length > 3`, which was meant to
// drop noise but does the opposite: it keeps "with", "from", "says", "after",
// "amid", "could", "this" - the words every headline shares - while throwing
// away "ETF", "SEC", "BTC", "Fed", "DOJ", the three-letter tokens that actually
// identify a story. Filtering by meaning rather than length fixes both ends.
const STOPWORDS = new Set([
  "the", "and", "for", "but", "not", "you", "all", "any", "are", "was", "were", "with", "from",
  "this", "that", "these", "those", "have", "has", "had", "been", "being", "will", "would",
  "can", "could", "should", "may", "might", "must", "into", "onto", "over", "under", "after",
  "before", "amid", "about", "than", "then", "them", "they", "their", "there", "here", "what",
  "when", "where", "which", "who", "whom", "how", "why", "its", "his", "her", "our", "your",
  "new", "now", "more", "most", "less", "least", "very", "just", "also", "still", "yet", "how",
  "says", "said", "say", "report", "reports", "reported", "update", "updates", "latest",
  "news", "breaking", "live", "watch", "read", "here", "out", "off", "per", "via", "amid",
]);

/** The words in a title that actually identify the story it is about. */
function significantWords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

/**
 * Stable-ish id + exact-match dedupe key from a title.
 *
 * Sorted, so word order does not matter - and NOT truncated. The old key did
 * `.slice(0, 6)` *before* `.sort()`, taking the first six long words in title
 * order. That made the key position-sensitive in exactly the case it existed to
 * handle: two outlets reporting one event with the headline rearranged got
 * different first-six sets, so different keys, so both were shown. Hence the
 * same story appearing several times from several sources.
 */
export function eventKey(title: string): string {
  return [...new Set(significantWords(title))].sort().join(" ");
}

/** Overlap of two token sets, 0..1 (intersection over union). */
function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  return shared / (a.size + b.size - shared);
}

// Two outlets rarely produce the *identical* significant-word set - one says
// "approves", another "approved", one adds the dollar figure. An exact key
// alone will always miss those, so anything that clears the exact check is
// then compared for overlap against what has already been kept.
const SIMILARITY_THRESHOLD = 0.6;
// Reports of one event cluster in time. Bounding the comparison to a window
// keeps this from being a full O(n^2) sweep, and stops a recurring headline
// ("Bitcoin price analysis") from collapsing months of separate stories.
const SAME_EVENT_WINDOW_MS = 36 * 60 * 60 * 1000;

/** Remove near-duplicate stories (same event across outlets); keeps the newest. */
export function dedupe(items: NewsItem[]): NewsItem[] {
  const byKey = new Map<string, NewsItem>();
  const kept: Array<{ item: NewsItem; words: Set<string> }> = [];

  for (const it of [...items].sort((a, b) => b.publishedAt - a.publishedAt)) {
    const words = new Set(significantWords(it.title));
    const k = [...words].sort().join(" ");

    if (!k) {
      // Nothing usable in the title - fall back to identity so it is never
      // silently merged into an unrelated story.
      byKey.set(it.id, it);
      kept.push({ item: it, words });
      continue;
    }
    if (byKey.has(k)) continue; // exact same event, already have the newer one

    // Near-duplicate check against what survived. Items arrive newest-first, so
    // `kept` runs newest to oldest and the entries closest in time to `it` are
    // at the END - walk backwards from there and stop as soon as we are past
    // the window. (`prev` is always the newer of the two, so the subtraction
    // goes prev - it; the other way round is always negative and would never
    // break, quietly turning this into a full O(n^2) sweep.)
    let duplicate = false;
    for (let i = kept.length - 1; i >= 0; i--) {
      const prev = kept[i];
      if (prev.item.publishedAt - it.publishedAt > SAME_EVENT_WINDOW_MS) break;
      if (similarity(words, prev.words) >= SIMILARITY_THRESHOLD) {
        duplicate = true;
        break;
      }
    }
    if (duplicate) continue;

    byKey.set(k, it);
    kept.push({ item: it, words });
  }

  return kept.map((k) => k.item).sort((a, b) => b.publishedAt - a.publishedAt);
}
