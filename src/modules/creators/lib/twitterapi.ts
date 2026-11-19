// twitterapi.io client: the paid, pay-as-you-go X data source the owner chose
// for the Variational board (the free X API cannot read or search posts).
//
// Auth: `X-API-Key` header. Billing is per returned item (~$0.15 per 1,000
// posts), so every caller in x-index.ts goes through a daily budget.
//
// The parser is deliberately tolerant: field names below are the ones the
// provider documents, with fallbacks for the variants seen in its examples.
// A post that cannot be read cleanly is dropped rather than half-stored.

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
    name: String(raw?.name || handle).slice(0, 120),
    avatar: avatar(raw?.profilePicture ?? raw?.profile_image_url_https),
    followers: int(raw?.followers ?? raw?.followers_count),
    verified: Boolean(raw?.isBlueVerified ?? raw?.isVerified ?? raw?.verified),
    bio: String(raw?.description ?? raw?.profile_bio?.description ?? "").slice(0, 300),
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
    text: text.slice(0, 4000),
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

// ------------------------------------------------------------ relevance

/** The board's search: Variational by name, handle or site; reposts excluded. */
export const VARIATIONAL_QUERY = '(variational OR @variational_io OR "variational.io") -filter:retweets';

export function handleQuery(handle: string): string {
  return `from:${handle} (variational OR @variational_io OR "variational.io") -filter:retweets`;
}

// "Variational" is also a maths / ML word. Posts that are clearly about that,
// with nothing tying them to the exchange, are not counted.
const ACADEMIC = /\b(autoencoder|vae|inference|bayesian|elbo|quantum|calculus|variational (method|principle|bound|family|approximation|form|problem|formulation)|posterior|latent|eigen)/i;
const EXCHANGE = /(@variational|variational\.io|\$var\b|perp|dex|omni|rfq|airdrop|points|trading|arbitrum|tge|testnet|mainnet|leverage|funding|loss refund)/i;

export function isVariationalPost(text: string): boolean {
  if (!/variational/i.test(text)) return false;
  if (EXCHANGE.test(text)) return true;
  return !ACADEMIC.test(text);
}

/** Variational's own accounts are shown as official, not ranked against creators. */
export function isOfficialHandle(handle: string): boolean {
  return /^variational/i.test(handle);
}

export function validHandle(input: string): string | null {
  const h = input.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "").split(/[/?#]/)[0] ?? "";
  return /^[A-Za-z0-9_]{1,15}$/.test(h) ? h : null;
}
