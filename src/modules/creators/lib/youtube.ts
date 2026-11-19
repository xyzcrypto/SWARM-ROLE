// YouTube Data API v3 client for the /creators leaderboard.
//
// Quota (free tier, 10,000 units/day per key):
//   search.list   = 100 units per call  (2 per topic: by views + by date)
//   videos.list   =   1 unit per 50 ids
//   channels.list =   1 unit per 50 ids
// So one topic refresh costs ~205 units and all seven ~1,435. The route caches
// each topic for 12h, which caps a full day at under 3,000 units no matter how
// much traffic the page gets - visitor count never reaches the quota.
//
// No env access here: the key is passed in, so tests can drive this with a
// recorded fixture and a stub fetch.

import { isRelevant, type Topic, type YtVideo } from "./scoring";

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
export async function fetchTopic(topic: Topic, apiKey: string, now: number, f: FetchLike = fetch): Promise<YtVideo[]> {
  const publishedAfter = new Date(now - LOOKBACK_DAYS * 86_400_000).toISOString();
  const base = { part: "snippet", type: "video", maxResults: "50", q: topic.query, publishedAfter };

  const searches = await Promise.all(
    (["viewCount", "date"] as const).map((order) => call("search", { ...base, order }, apiKey, f))
  );
  const ids = [
    ...new Set(searches.flatMap((s) => (s?.items ?? []).map((it: any) => it?.id?.videoId).filter(Boolean) as string[])),
  ];
  if (!ids.length) return [];

  const videoItems: any[] = [];
  for (const group of chunks(ids, 50)) {
    const r = await call("videos", { part: "snippet,statistics,contentDetails", id: group.join(","), maxResults: "50" }, apiKey, f);
    videoItems.push(...(r?.items ?? []));
  }

  const relevant = videoItems.filter((v) => isRelevant(topic, v?.snippet?.title ?? "", v?.snippet?.description ?? ""));
  if (!relevant.length) return [];

  const channelIds = [...new Set(relevant.map((v) => v.snippet?.channelId).filter(Boolean) as string[])];
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

  return relevant.map((v): YtVideo => {
    const ch = channels.get(v.snippet.channelId);
    return {
      id: v.id,
      title: v.snippet.title ?? "",
      // Trimmed: the client only needs it for search, and full descriptions
      // would multiply the cached payload for nothing.
      description: String(v.snippet.description ?? "").slice(0, 240),
      publishedAt: v.snippet.publishedAt,
      thumbnail: bestThumb(v.snippet.thumbnails),
      channelId: v.snippet.channelId,
      channelTitle: v.snippet.channelTitle ?? "",
      channelAvatar: ch?.avatar ?? null,
      channelSubs: ch?.subs ?? null,
      views: num(v.statistics?.viewCount) ?? 0,
      likes: num(v.statistics?.likeCount),
      comments: num(v.statistics?.commentCount),
      durationSec: parseDuration(v.contentDetails?.duration),
      topics: [topic.id],
    };
  });
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
