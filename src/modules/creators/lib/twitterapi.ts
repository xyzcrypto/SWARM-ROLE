// twitterapi.io client: the paid, pay-as-you-go X data source the owner chose
// for the Variational board (the free X API cannot read or search posts).
//
// Auth: `X-API-Key` header. Billing is per returned item (~$0.15 per 1,000
// posts), so every caller in x-index.ts goes through a daily budget.
//
// The parser is deliberately tolerant: field names below are the ones the
// provider documents, with fallbacks for the variants seen in its examples.
// A post that cannot be read cleanly is dropped rather than half-stored.

import { cleanText } from "./text";
const BASE = "https://api.twitterapi.io";

export class TwitterApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "TwitterApiError";
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type XUser = {
  id: string | null;
  handle: string;
  name: string;
  avatar: string | null;
  followers: number;
  verified: boolean;
  bio: string;
};

export type XTweetData = {
  id: string;
  url: string;
  text: string;
  createdAt: string; // ISO
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  bookmarks: number;
  isReply: boolean;
  isRetweet: boolean;
  author: XUser;
};

function int(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** Larger avatar than the 48px "_normal" default, same CDN. */
function avatar(url: unknown): string | null {
  if (typeof url !== "string" || !url.startsWith("https://")) return null;
  return url.replace("_normal.", "_200x200.");
}

export function normalizeUser(raw: any): XUser | null {
  const handle = raw?.userName ?? raw?.screen_name ?? raw?.username;
  if (!handle || typeof handle !== "string") return null;
  return {
    id: raw?.id != null ? String(raw.id) : null,
    handle,
    name: cleanText(raw?.name || handle, 120),
    avatar: avatar(raw?.profilePicture ?? raw?.profile_image_url_https),
    followers: int(raw?.followers ?? raw?.followers_count),
    verified: Boolean(raw?.isBlueVerified ?? raw?.isVerified ?? raw?.verified),
    bio: cleanText(raw?.description ?? raw?.profile_bio?.description ?? "", 300),
  };
}

export function normalizeTweet(raw: any): XTweetData | null {
  const id = raw?.id ?? raw?.id_str;
  const author = normalizeUser(raw?.author);
  if (!id || !author) return null;
  const created = Date.parse(raw?.createdAt ?? raw?.created_at ?? "");
  if (!Number.isFinite(created)) return null;
  const text = String(raw?.text ?? raw?.full_text ?? "");
  return {
    id: String(id),
    url: `https://x.com/${author.handle}/status/${id}`,
    text: cleanText(text, 4000),
    createdAt: new Date(created).toISOString(),
    views: int(raw?.viewCount ?? raw?.views),
    likes: int(raw?.likeCount ?? raw?.favorite_count),
    replies: int(raw?.replyCount ?? raw?.reply_count),
    reposts: int(raw?.retweetCount ?? raw?.retweet_count),
    quotes: int(raw?.quoteCount ?? raw?.quote_count),
    bookmarks: int(raw?.bookmarkCount ?? raw?.bookmark_count),
    isReply: Boolean(raw?.isReply ?? raw?.inReplyToId),
    isRetweet: Boolean(raw?.retweeted_tweet) || /^RT @/.test(text),
    author,
  };
}

async function get(path: string, params: Record<string, string>, key: string, f: FetchLike): Promise<any> {
  const res = await f(`${BASE}${path}?${new URLSearchParams(params)}`, {
    headers: { "X-API-Key": key, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.status === "error") {
    throw new TwitterApiError(body?.msg || body?.message || `twitterapi.io ${path} ${res.status}`, res.status);
  }
  return body;
}

export type SearchPage = { tweets: XTweetData[]; nextCursor: string | null; raw: number };

/** One page of X advanced search (X's own query syntax). */
export async function searchPage(
  query: string,
  type: "Latest" | "Top",
  cursor: string | null,
  key: string,
  f: FetchLike = fetch
): Promise<SearchPage> {
  const body = await get("/twitter/tweet/advanced_search", { query, queryType: type, ...(cursor ? { cursor } : {}) }, key, f);
  const list: any[] = Array.isArray(body?.tweets) ? body.tweets : [];
  const next = body?.has_next_page && body?.next_cursor ? String(body.next_cursor) : null;
  return { tweets: list.map(normalizeTweet).filter((t): t is XTweetData => !!t), nextCursor: next, raw: list.length };
}

/** Current counts for specific posts (used to refresh older posts in rotation). */
export async function tweetsById(ids: string[], key: string, f: FetchLike = fetch): Promise<XTweetData[]> {
  if (!ids.length) return [];
  const body = await get("/twitter/tweets", { tweet_ids: ids.join(",") }, key, f);
  const list: any[] = Array.isArray(body?.tweets) ? body.tweets : [];
  return list.map(normalizeTweet).filter((t): t is XTweetData => !!t);
}

export async function userInfo(handle: string, key: string, f: FetchLike = fetch): Promise<XUser | null> {
  const body = await get("/twitter/user/info", { userName: handle }, key, f);
  return normalizeUser(body?.data ?? body);
}

// ------------------------------------------------------------ venues

// Every venue the X board tracks. Each has the X search that finds its posts
// and a relevance test, because both names are ordinary words too:
// "variational" is maths/ML, and "Entropy" is also physics and Pyth's
// randomness product. A post counts for a venue only if it passes that test.
export type VenueId = "variational" | "entropy";

export type Venue = {
  id: VenueId;
  label: string;
  handle: string; // official X account
  site: string;
  blurb: string;
  /** X advanced-search clause that finds candidate posts (reposts excluded separately). */
  match: string;
  relevant: (text: string) => boolean;
  official: (handle: string) => boolean;
};

// "Variational" is also a maths / ML word. Posts that are clearly about that,
// with nothing tying them to the exchange, are not counted.
const VAR_ACADEMIC = /\b(autoencoders?|vaes?|inference|bayesian|elbo|quantum|vqe|calculus|variational (method|principle|bound|family|approximation|form|problem|formulation|circuit|algorithm|model)|posterior|latent|eigen|neural|diffusion|arxiv|preprint|theorem|physics|hamiltonian|monte carlo|gaussian)/i;
const VAR_EXCHANGE = /(@variational|variational\.io|\$var\b|perp|dex|omni|rfq|airdrop|points|trading|arbitrum|tge|testnet|mainnet|leverage|funding|loss refund)/i;

export function isVariationalPost(text: string): boolean {
  if (!/variational/i.test(text)) return false;
  if (VAR_EXCHANGE.test(text)) return true;
  return !VAR_ACADEMIC.test(text);
}

// Entropy (entropy.io, @EntropyIO): a HIP-3 perp venue on Hyperliquid with
// pre-IPO and equity perps. A bare "entropy" is almost never about it, so it
// needs the handle, the site, or the word next to its own context.
const ENT_DIRECT = /(@entropyio\b|entropy\.io\b)/i;
const ENT_CONTEXT = /(hyperliquid|hip-?3|\bperps?\b|pre-?ipo|anthropic|\$ant\b|equity perps?|sndk|funding rate|open interest)/i;
const ENT_OTHER = /(pyth entropy|\brng\b|randomness|thermodynamic|second law|shannon|information theory|password entropy)/i;

export function isEntropyPost(text: string): boolean {
  if (ENT_DIRECT.test(text)) return true;
  if (!/\bentropy\b/i.test(text)) return false;
  if (ENT_OTHER.test(text)) return false;
  return ENT_CONTEXT.test(text);
}

// The X board tracks Variational only (owner's call). Entropy stays a YouTube
// topic; its X relevance test above is kept for if it ever returns here.
export const VENUES: Venue[] = [
  {
    id: "variational",
    label: "Variational",
    handle: "variational_io",
    site: "variational.io",
    blurb: "Peer-to-peer perps with RFQ fills, on Arbitrum.",
    match: '(variational OR @variational_io OR "variational.io")',
    relevant: isVariationalPost,
    official: (h) => /^variational/i.test(h),
  },
];

export function venueById(id: string): Venue | undefined {
  return VENUES.find((v) => v.id === id);
}

/** Every venue a post is about (empty = about none of them). */
export function venuesFor(text: string): VenueId[] {
  return VENUES.filter((v) => v.relevant(text)).map((v) => v.id);
}

export function venueQuery(v: Venue): string {
  return `${v.match} -filter:retweets`;
}

/** One search for a handle across every venue; posts are classified after. */
export function handleQuery(handle: string): string {
  return `from:${handle} (${VENUES.map((v) => v.match).join(" OR ")}) -filter:retweets`;
}

/** Official venue accounts are shown, not ranked against creators. */
export function isOfficialHandle(handle: string): boolean {
  return VENUES.some((v) => v.official(handle));
}

export function validHandle(input: string): string | null {
  const h = input.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "").split(/[/?#]/)[0] ?? "";
  return /^[A-Za-z0-9_]{1,15}$/.test(h) ? h : null;
}
