// Pure ranking logic for the /creators leaderboard. No I/O, no env, no Date.now()
// at import time, so it runs identically on the server, in the browser and in
// tests. Every number a visitor sees is derived here from public counts, and the
// formulas are printed on the page - nothing is weighted in secret.

export type TopicId =
  | "all"
  | "variational"
  | "hyperliquid"
  | "lighter"
  | "aster"
  | "edgex"
  | "paradex"
  | "perp-dex";

export type Topic = {
  id: Exclude<TopicId, "all">;
  label: string;
  /** What we send to YouTube search. */
  query: string;
  /**
   * Relevance gate on title + description, lowercased. Every group must match
   * at least one of its terms. YouTube search is fuzzy ("lighter" returns
   * cigarette lighters), so a result only counts if it is actually about the
   * venue.
   */
  must: string[][];
};

const PERP_CONTEXT = ["perp", "dex", "airdrop", "points", "trading", "futures", "crypto", "defi", "testnet", "tge", "token"];

export const TOPICS: Topic[] = [
  { id: "variational", label: "Variational", query: "Variational perp dex", must: [["variational"], ["perp", "dex", "omni", "rfq", "airdrop", "points", "trading", "crypto", "arbitrum", "defi", "tge"]] },
  { id: "hyperliquid", label: "Hyperliquid", query: "Hyperliquid", must: [["hyperliquid"]] },
  { id: "lighter", label: "Lighter", query: "Lighter perp dex", must: [["lighter"], PERP_CONTEXT] },
  { id: "aster", label: "Aster", query: "Aster dex", must: [["aster"], PERP_CONTEXT] },
  { id: "edgex", label: "edgeX", query: "edgeX exchange", must: [["edgex"]] },
  { id: "paradex", label: "Paradex", query: "Paradex", must: [["paradex"]] },
  { id: "perp-dex", label: "Perp DEX", query: "perp dex", must: [["perp dex", "perpetual dex", "perps dex", "perp-dex", "perpetual exchange", "decentralized perpetual"]] },
];

export function topicById(id: string): Topic | undefined {
  return TOPICS.find((t) => t.id === id);
}

export function isRelevant(topic: Topic, title: string, description: string): boolean {
  const hay = `${title}\n${description}`.toLowerCase();
  return topic.must.every((group) => group.some((term) => hay.includes(term)));
}

// ---------------------------------------------------------------- YouTube

export type YtVideo = {
  id: string;
  title: string;
  description: string;
  publishedAt: string; // ISO
  thumbnail: string;
  channelId: string;
  channelTitle: string;
  channelAvatar: string | null;
  channelSubs: number | null; // null when the channel hides it
  views: number;
  likes: number | null; // null when the uploader hides likes
  comments: number | null; // null when comments are off
  durationSec: number;
  topics: TopicId[];
};

/**
 * Video score = views / 100 + likes + 2 x comments.
 * Views are the cheapest signal, so they are scaled down; a comment costs a
 * viewer the most effort, so it counts double a like. Hidden counts score 0
 * rather than being guessed.
 */
export function videoScore(v: Pick<YtVideo, "views" | "likes" | "comments">): number {
  return Math.round(v.views / 100 + (v.likes ?? 0) + 2 * (v.comments ?? 0));
}

export type WindowId = "7d" | "30d" | "90d" | "1y" | "all";
export const WINDOW_DAYS: Record<WindowId, number | null> = { "7d": 7, "30d": 30, "90d": 90, "1y": 365, all: null };

export function withinWindow(iso: string, win: WindowId, now: number): boolean {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  const days = WINDOW_DAYS[win];
  return days == null || now - t <= days * 86_400_000;
}

/** Engagement per view: (likes + comments) / views. Null below 100 views (too noisy). */
export function engagementRate(v: Pick<YtVideo, "views" | "likes" | "comments">): number | null {
  if (v.views < 100) return null;
  return ((v.likes ?? 0) + (v.comments ?? 0)) / v.views;
}

export function isShort(v: Pick<YtVideo, "durationSec">): boolean {
  return v.durationSec > 0 && v.durationSec <= 180;
}

export type YtCreator = {
  channelId: string;
  channelTitle: string;
  channelAvatar: string | null;
  channelSubs: number | null;
  videos: number;
  views: number;
  likes: number;
  comments: number;
  points: number;
  best: { id: string; title: string; score: number };
};

/** Creator points = the sum of their videos' scores, inside the chosen window. */
export function rankYoutubeCreators(videos: YtVideo[]): YtCreator[] {
  const by = new Map<string, YtCreator>();
  for (const v of videos) {
    const s = videoScore(v);
    const c = by.get(v.channelId);
    if (!c) {
      by.set(v.channelId, {
        channelId: v.channelId,
        channelTitle: v.channelTitle,
        channelAvatar: v.channelAvatar,
        channelSubs: v.channelSubs,
        videos: 1,
        views: v.views,
        likes: v.likes ?? 0,
        comments: v.comments ?? 0,
        points: s,
        best: { id: v.id, title: v.title, score: s },
      });
      continue;
    }
    c.videos += 1;
    c.views += v.views;
    c.likes += v.likes ?? 0;
    c.comments += v.comments ?? 0;
    c.points += s;
    if (s > c.best.score) c.best = { id: v.id, title: v.title, score: s };
  }
  return [...by.values()].sort((a, b) => b.points - a.points || b.views - a.views);
}

/** Case-insensitive match against any of the given fields. Empty query matches all. */
export function matchesQuery(q: string, ...fields: (string | null | undefined)[]): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(needle));
}

/** "1.2K" / "3.4M", pinned to en-US so SSR and the browser agree. */
export function compactCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
