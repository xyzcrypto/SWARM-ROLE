// Pure ranking logic for the /creators leaderboard. No I/O, no env, no Date.now()
// at import time, so it runs identically on the server, in the browser and in
// tests. Every number a visitor sees is derived here from public counts, and the
// formulas are printed on the page - nothing is weighted in secret.

export type TopicId =
  | "all"
  | "variational"
  | "entropy"
  | "hyperliquid"
  | "lighter"
  | "aster"
  | "edgex"
  | "paradex"
  | "gmx"
  | "dydx"
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
  // Entropy (entropy.io): HIP-3 venue on Hyperliquid with pre-IPO / equity
  // perps. "Entropy" alone is physics and Pyth's RNG, so it needs Entropy's
  // own context next to it.
  { id: "entropy", label: "Entropy", query: "Entropy Hyperliquid HIP-3 perps", must: [["entropy"], ["hyperliquid", "hip-3", "hip3", "pre-ipo", "pre ipo", "entropy.io", "perp"]] },
  { id: "hyperliquid", label: "Hyperliquid", query: "Hyperliquid", must: [["hyperliquid"]] },
  { id: "lighter", label: "Lighter", query: "Lighter perp dex", must: [["lighter"], PERP_CONTEXT] },
  { id: "aster", label: "Aster", query: "Aster dex", must: [["aster"], PERP_CONTEXT] },
  { id: "edgex", label: "edgeX", query: "edgeX exchange", must: [["edgex"]] },
  { id: "paradex", label: "Paradex", query: "Paradex", must: [["paradex"]] },
  { id: "gmx", label: "GMX", query: "GMX perpetual exchange", must: [["gmx"], PERP_CONTEXT] },
  { id: "dydx", label: "dYdX", query: "dYdX", must: [["dydx"]] },
  { id: "perp-dex", label: "Perp DEX", query: "perp dex", must: [["perp dex", "perpetual dex", "perps dex", "perp-dex", "perpetual exchange", "decentralized perpetual"]] },
];

export function topicById(id: string): Topic | undefined {
  return TOPICS.find((t) => t.id === id);
}

/**
 * The venue term (first group) must be in the TITLE. Descriptions are full of
 * referral links and sponsor blurbs ("trade on Hyperliquid with my code"), so
 * a description-only mention says nothing about what the video is about.
 * The context groups may match title or description.
 */
export function isRelevant(topic: Topic, title: string, description: string): boolean {
  const t = title.toLowerCase();
  const hay = `${t}\n${description.toLowerCase()}`;
  const [venue, ...context] = topic.must;
  if (venue && !venue.some((term) => t.includes(term))) return false;
  return context.every((group) => group.some((term) => hay.includes(term)));
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
 * Video points = views / 100 x (1 + depth) + likes + 2 x comments,
 * where depth = min(1, minutes / 20).
 * Views are the cheapest signal, so they are scaled down. Depth is a
 * watch-time credit: a 20-minute deep dive earns up to double view credit,
 * a 30-second Short almost none. A comment costs a viewer the most effort,
 * so it counts double a like. Hidden counts score 0 rather than being guessed.
 */
export const DEPTH_FULL_SEC = 1200;

export function depthOf(durationSec: number): number {
  return Math.min(1, Math.max(0, durationSec) / DEPTH_FULL_SEC);
}

export function videoScore(v: Pick<YtVideo, "views" | "likes" | "comments" | "durationSec">): number {
  return Math.round((v.views / 100) * (1 + depthOf(v.durationSec)) + (v.likes ?? 0) + 2 * (v.comments ?? 0));
}

/** Output bonus per video in the window, so consistent creators are not out-ranked by one lucky upload. */
export const PER_VIDEO_BONUS = 25;

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

/**
 * Views per day since upload - the "trending" signal, so a strong new video
 * is not buried under years-old totals. Clamped to at least one day.
 */
export function viewsPerDay(v: Pick<YtVideo, "views" | "publishedAt">, now: number): number {
  const t = Date.parse(v.publishedAt);
  if (!Number.isFinite(t)) return 0;
  return v.views / Math.max(1, (now - t) / 86_400_000);
}

export type CreatorScoreParts = { reach: number; output: number; approval: number; conversation: number; depth: number; total: number };

/**
 * Creator Score, 0-1000, from five measured parts:
 *  - Reach (250):        total views, log scale (~3M = full)
 *  - Output (150):       videos in the window (10 = full)
 *  - Approval (200):     likes per view (5% = full)
 *  - Conversation (150): comments per view (0.5% = full)
 *  - Depth (250):        average video length (20 min = full)
 * Rate parts need 100+ views, below that they are noise.
 */
export function creatorScore(c: { views: number; videos: number; likes: number; comments: number; durationSec: number }): CreatorScoreParts {
  const k = (x: number) => Math.min(1, Math.max(0, x));
  const enough = c.views >= 100;
  const reach = k(Math.log10(c.views + 1) / 6.5) * 250;
  const output = k(c.videos / 10) * 150;
  const approval = (enough ? k(c.likes / c.views / 0.05) : 0) * 200;
  const conversation = (enough ? k(c.comments / c.views / 0.005) : 0) * 150;
  const depth = (c.videos ? k(c.durationSec / c.videos / DEPTH_FULL_SEC) : 0) * 250;
  const r = Math.round;
  return { reach: r(reach), output: r(output), approval: r(approval), conversation: r(conversation), depth: r(depth), total: r(reach + output + approval + conversation + depth) };
}

export type YtCreator = {
  channelId: string;
  channelTitle: string;
  channelAvatar: string | null;
  channelSubs: number | null;
  videos: number;
  shorts: number;
  views: number;
  likes: number;
  comments: number;
  /** Total runtime of their videos in the window, seconds. */
  durationSec: number;
  /** Sum of video points + PER_VIDEO_BONUS per video. */
  points: number;
  score: CreatorScoreParts;
  best: { id: string; title: string; score: number };
  latest: string; // ISO of newest video
};

/** Creator points = sum of video points + an output bonus per video, inside the chosen window. */
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
        shorts: isShort(v) ? 1 : 0,
        views: v.views,
        likes: v.likes ?? 0,
        comments: v.comments ?? 0,
        durationSec: v.durationSec,
        points: s + PER_VIDEO_BONUS,
        score: creatorScore({ views: 0, videos: 0, likes: 0, comments: 0, durationSec: 0 }),
        best: { id: v.id, title: v.title, score: s },
        latest: v.publishedAt,
      });
      continue;
    }
    c.videos += 1;
    c.shorts += isShort(v) ? 1 : 0;
    c.views += v.views;
    c.likes += v.likes ?? 0;
    c.comments += v.comments ?? 0;
    c.durationSec += v.durationSec;
    c.points += s + PER_VIDEO_BONUS;
    if (s > c.best.score) c.best = { id: v.id, title: v.title, score: s };
    if (v.publishedAt > c.latest) c.latest = v.publishedAt;
  }
  const list = [...by.values()];
  for (const c of list) c.score = creatorScore(c);
  return list.sort((a, b) => b.points - a.points || b.views - a.views || a.channelTitle.localeCompare(b.channelTitle));
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
