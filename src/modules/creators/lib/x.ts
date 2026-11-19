// X (Twitter) post data for the Variational leaderboard, without the paid API.
//
// The free X API tier cannot read or search posts, so the leaderboard is built
// from links people submit. For each link we read the same public embed data
// X serves to every website that embeds a post (cdn.syndication.twimg.com, the
// source Vercel's react-tweet uses). It carries likes, reply count, author and
// text. It does NOT carry views or reposts, so the points formula uses only
// what it actually has.
//
// That endpoint is unofficial: if X changes or closes it, fetchTweet() starts
// returning `unavailable` and the leaderboard keeps serving the last counts it
// stored, rather than inventing new ones.

const SYNDICATION = "https://cdn.syndication.twimg.com/tweet-result";

const HOSTS = new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com", "mobile.x.com"]);

/** Accepts x.com / twitter.com status links; returns the numeric post id, else null. */
export function parseTweetUrl(input: string): { id: string; handle: string } | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (!HOSTS.has(u.hostname.toLowerCase())) return null;
  const m = /^\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{5,25})(?:\/|$)/.exec(u.pathname);
  if (!m) return null;
  return { handle: m[1]!, id: m[2]! };
}

export function canonicalTweetUrl(handle: string, id: string): string {
  return `https://x.com/${handle}/status/${id}`;
}

/** The token the embed endpoint expects, derived from the id (same as react-tweet). */
export function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
}

export type Tweet = {
  id: string;
  text: string;
  createdAt: string; // ISO
  likes: number;
  replies: number;
  handle: string;
  name: string;
  avatar: string | null;
  verified: boolean;
  /** Expanded link targets and @mentions, for the Variational check. */
  links: string[];
  mentions: string[];
};

export type FetchTweetResult =
  | { ok: true; tweet: Tweet }
  | { ok: false; reason: "not_found" | "unavailable" };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? Math.round(x) : 0;
}

/** Shape the raw embed JSON into what we store. Exported for fixture tests. */
export function normalizeTweet(raw: any): Tweet | null {
  if (!raw || raw.__typename === "TweetTombstone" || !raw.id_str || !raw.user?.screen_name) return null;
  // Long posts keep the full body in note_tweet; `text` is truncated there.
  const longText: string | undefined = raw.note_tweet?.note_tweet_results?.result?.text;
  const text = String(longText || raw.text || "");
  const created = Date.parse(raw.created_at);
  return {
    id: String(raw.id_str),
    text,
    createdAt: Number.isFinite(created) ? new Date(created).toISOString() : new Date(0).toISOString(),
    likes: n(raw.favorite_count),
    replies: n(raw.conversation_count),
    handle: String(raw.user.screen_name),
    name: String(raw.user.name || raw.user.screen_name),
    avatar: typeof raw.user.profile_image_url_https === "string" ? raw.user.profile_image_url_https : null,
    verified: Boolean(raw.user.is_blue_verified || raw.user.verified),
    links: (raw.entities?.urls ?? []).map((x: any) => String(x?.expanded_url || "")).filter(Boolean),
    mentions: (raw.entities?.user_mentions ?? []).map((x: any) => String(x?.screen_name || "")).filter(Boolean),
  };
}

/**
 * A post counts for the Variational board only if it is about Variational in
 * its own words: the name in the text, an @mention of a Variational account,
 * or a link to variational.io. A quote of someone else's Variational post is
 * not enough, so the board ranks creators rather than quote-reposters.
 */
export function mentionsVariational(t: Pick<Tweet, "text" | "links" | "mentions">): boolean {
  if (/variational/i.test(t.text)) return true;
  if (t.mentions.some((m) => /^variational/i.test(m))) return true;
  return t.links.some((l) => {
    try {
      const h = new URL(l).hostname.toLowerCase();
      return h === "variational.io" || h.endsWith(".variational.io");
    } catch {
      return false;
    }
  });
}

export async function fetchTweet(id: string, f: FetchLike = fetch): Promise<FetchTweetResult> {
  const qs = new URLSearchParams({ id, lang: "en", token: syndicationToken(id) });
  let res: Response;
  try {
    res = await f(`${SYNDICATION}?${qs}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (res.status === 404) return { ok: false, reason: "not_found" };
  if (!res.ok) return { ok: false, reason: "unavailable" };
  const raw = await res.json().catch(() => null);
  if (raw?.__typename === "TweetTombstone") return { ok: false, reason: "not_found" };
  const tweet = normalizeTweet(raw);
  return tweet ? { ok: true, tweet } : { ok: false, reason: "not_found" };
}
