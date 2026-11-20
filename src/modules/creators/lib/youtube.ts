// YouTube Data API v3 client for the /creators leaderboard.
//
// Quota (free tier, 10,000 units/day per key):
//   search.list   = 100 units per call  (2 per topic: all-time most viewed and
//                   newest of the last 90 days, plus a venue's extra phrases)
//   videos.list   =   1 unit per 50 ids
//   channels.list =   1 unit per 50 ids
// So one topic refresh costs ~310 units and all ten ~3,100. The route caches
// each topic for 12h, which caps a full day at about 6,200 units of the free
// 10,000 no matter how much traffic the page gets.
//
// No env access here: the key is passed in, so tests can drive this with a
// recorded fixture and a stub fetch.

import { topicsFor, type Topic, type YtVideo } from "./scoring";
import { cleanText } from "./text";

const API = "https://www.googleapis.com/youtube/v3";
export const LOOKBACK_DAYS = 90;

export class YoutubeError extends Error {
  constructor(
    message: string,
    public status: number,
    public reason: string
  ) {
    super(message);
    this.name = "YoutubeError";
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

async function call(path: string, params: Record<string, string>, apiKey: string, f: FetchLike): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  // Header, not `key=` in the URL, so the key never lands in a URL-shaped log line.
  const res = await f(`${API}/${path}?${qs}`, {
    headers: { "X-Goog-Api-Key": apiKey, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const reason: string = body?.error?.errors?.[0]?.reason || body?.error?.status || "unknown";
    throw new YoutubeError(body?.error?.message || `YouTube ${path} ${res.status}`, res.status, reason);
  }
  return body;
}

/** "PT1H2M3S" -> 3723. Unknown shapes -> 0. */
export function parseDuration(iso: string | undefined): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
  if (!m) return 0;
  const [, d, h, mi, s] = m;
  return Number(d || 0) * 86400 + Number(h || 0) * 3600 + Number(mi || 0) * 60 + Number(s || 0);
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function bestThumb(t: any): string {
  return t?.medium?.url || t?.high?.url || t?.default?.url || "";
}

/**
 * Two searches per topic (most viewed + newest inside the lookback), then the
 * real statistics from videos.list and channels.list. search.list's own counts
 * are not used - it has none - so every number shown comes from the
 * statistics endpoints.
 */
/**
 * Discovery for one topic: the search calls (most viewed of all time, two
 * pages; most viewed and newest of the last 90 days; plus the topic's extra
 * phrases), then the real statistics and channel info for every hit.
 *
 * Returns the hits UNFILTERED, with a long description, so relevance can be
 * (re)applied at read time by topicsFor() without spending quota again.
 */
export async function fetchTopic(topic: Topic, apiKey: string, now: number, f: FetchLike = fetch): Promise<YtVideo[]> {
  const publishedAfter = new Date(now - LOOKBACK_DAYS * 86_400_000).toISOString();
  const base = { part: "snippet", type: "video", maxResults: "50", q: topic.query };

  // Two core searches (100 units each): the all-time most viewed, and the
  // newest of the last 90 days, so fresh videos are found even before they
  // rack up views. A venue's extra phrases are best-effort: one failing does
  // not throw away the rest. The live view counts come from videos.list (1
  // unit per 50), so dropping the old 90-day "most viewed" search and the
  // second all-time page costs no accuracy on numbers, only some long-tail
  // discovery - and halves the quota (YouTube kept running out).
  const core = await Promise.all([
    call("search", { ...base, order: "viewCount" }, apiKey, f),
    call("search", { ...base, order: "date", publishedAfter }, apiKey, f),
  ]);
  const extra = await Promise.allSettled((topic.extraQueries ?? []).map((q) => call("search", { ...base, q, order: "viewCount" }, apiKey, f)));
  const searches = [...core, ...extra.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))];
  const ids = [
    ...new Set(searches.flatMap((s) => (s?.items ?? []).map((it: any) => it?.id?.videoId).filter(Boolean) as string[])),
  ];
  if (!ids.length) return [];

  const videoItems: any[] = [];
  for (const group of chunks(ids, 50)) {
    const r = await call("videos", { part: "snippet,statistics,contentDetails", id: group.join(","), maxResults: "50" }, apiKey, f);
    videoItems.push(...(r?.items ?? []));
  }
  // Channel info for every hit that is about ANY venue (1 unit per 50), so a
  // video re-tagged into another venue at read time still has its channel.
  const relevantNow = videoItems.filter((v) => topicsFor(v?.snippet?.title ?? "", v?.snippet?.description ?? "").length > 0);

  const channelIds = [...new Set(relevantNow.map((v) => v.snippet?.channelId).filter(Boolean) as string[])];
  const channels = new Map<string, { avatar: string | null; subs: number | null }>();
  for (const group of chunks(channelIds, 50)) {
    const r = await call("channels", { part: "snippet,statistics", id: group.join(","), maxResults: "50" }, apiKey, f);
    for (const c of r?.items ?? []) {
      channels.set(c.id, {
        avatar: bestThumb(c.snippet?.thumbnails) || null,
        subs: c.statistics?.hiddenSubscriberCount ? null : num(c.statistics?.subscriberCount),
      });
    }
  }

  return videoItems.map((v): YtVideo => {
    const ch = channels.get(v.snippet.channelId);
    return {
      id: v.id,
      title: cleanText(v.snippet.title, 300),
      // Long enough for the relevance context check; trimmed again before it
      // is sent to a browser.
      description: cleanText(v.snippet.description, 1500),
      publishedAt: v.snippet.publishedAt,
      thumbnail: bestThumb(v.snippet.thumbnails),
      channelId: v.snippet.channelId,
      channelTitle: cleanText(v.snippet.channelTitle, 200),
      channelAvatar: ch?.avatar ?? null,
      channelSubs: ch?.subs ?? null,
      views: num(v.statistics?.viewCount) ?? 0,
      likes: num(v.statistics?.likeCount),
      comments: num(v.statistics?.commentCount),
      durationSec: parseDuration(v.contentDetails?.duration),
      topics: [],
    };
  });
}

/**
 * Tag every video with every topic it is really about (title-first rules),
 * drop the ones about none, de-duplicate across topics' discovery sets and
 * trim descriptions for the browser.
 */
export function classify(lists: YtVideo[][]): YtVideo[] {
  const by = new Map<string, YtVideo>();
  for (const list of lists) {
    for (const v of list) {
      if (by.has(v.id)) continue;
      const topics = topicsFor(v.title, v.description);
      if (!topics.length) continue;
      by.set(v.id, { ...v, topics, description: cleanText(v.description, 240) });
    }
  }
  return [...by.values()];
}

/** Union of several topics' results, one row per video with every topic it matched. */
export function mergeTopics(lists: YtVideo[][]): YtVideo[] {
  const by = new Map<string, YtVideo>();
  for (const list of lists) {
    for (const v of list) {
      const prev = by.get(v.id);
      if (!prev) by.set(v.id, { ...v, topics: [...v.topics] });
      else for (const t of v.topics) if (!prev.topics.includes(t)) prev.topics.push(t);
    }
  }
  return [...by.values()];
}

export type LiveStats = Record<string, { views: number; likes: number | null; comments: number | null }>;

/**
 * Current counts for known videos: videos.list only, 1 quota unit per 50 ids.
 * This is what keeps the boards live - discovery (search, 100 units a call)
 * stays slow, the numbers on the videos it found refresh often.
 */
export async function fetchStats(ids: string[], apiKey: string, f: FetchLike = fetch): Promise<LiveStats> {
  const out: LiveStats = {};
  for (const group of chunks(ids, 50)) {
    const r = await call("videos", { part: "statistics", id: group.join(","), maxResults: "50" }, apiKey, f);
    for (const v of r?.items ?? []) {
      out[v.id] = { views: num(v.statistics?.viewCount) ?? 0, likes: num(v.statistics?.likeCount), comments: num(v.statistics?.commentCount) };
    }
  }
  return out;
}

/** Apply live counts on top of the discovery snapshot. Videos missing from `stats` keep their snapshot. */
export function withStats(videos: YtVideo[], stats: LiveStats): YtVideo[] {
  return videos.map((v) => {
    const s = stats[v.id];
    return s ? { ...v, views: s.views, likes: s.likes, comments: s.comments } : v;
  });
}

/** Quota cost of one discovery for a topic: 100 per search + ~5 for videos/channels lookups. */
export function discoveryUnits(topic: Topic): number {
  return 100 * (2 + (topic.extraQueries?.length ?? 0)) + 5;
}

/** The next midnight in America/Los_Angeles - when YouTube's daily quota resets. */
export function nextQuotaReset(now: number): number {
  const d = new Date(now);
  const la = new Date(d.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const offset = d.getTime() - la.getTime();
  const next = new Date(la);
  next.setHours(24, 0, 0, 0);
  return next.getTime() + offset;
}
