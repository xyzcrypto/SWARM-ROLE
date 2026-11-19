import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { env } from "@/lib/env";
import { handleError, fail } from "@/lib/api";
import { TOPICS, topicById, type YtVideo } from "@modules/creators/lib/scoring";
import { fetchStats, fetchTopic, mergeTopics, withStats, YoutubeError, type LiveStats } from "@modules/creators/lib/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/creators/youtube?topic=<id|all>
//
// Polled by /creators every YT_POLL_MS (540s) while the tab is visible, and
// listed in markets-poll-alignment.test.ts TARGETS. Three cache layers; the
// quota depends only on the inner two:
//  - DISCOVERY, unstable_cache 24h per topic: the search.list calls (100 units
//    each) that find which videos exist. ~410 units per topic, 10 topics, once
//    a day = ~4,100 units.
//  - LIVE STATS, unstable_cache 10 min per topic: videos.list on the ids
//    discovery found, 1 unit per 50 ids (~3 units a topic). At most 144
//    refreshes a day per topic = ~4,300 units. Together ~8,400 of the free
//    10,000, whatever the traffic. This is what makes views, likes and
//    comments current to within about 10 minutes.
//  - the edge, s-maxage 600 (>= the 540s poll, < 3x it): repeat visits never
//    reach the function.
// Both cached values are reduced (tens of kB), well under the 2 MB data cache
// ceiling, so they are actually stored.
const DISCOVERY_TTL = 86_400;
const STATS_TTL = 600;

type TopicPayload = { videos: YtVideo[]; fetchedAt: string };

// v2: the relevance rule changed (venue name must be in the title), so the
// v1 entries - built with the looser rule - must not be served. One extra
// discovery pass (~3,100 units) on deploy.
const cachedTopic = unstable_cache(
  async (topicId: string): Promise<TopicPayload> => {
    const topic = topicById(topicId);
    if (!topic) return { videos: [], fetchedAt: new Date().toISOString() };
    const videos = await fetchTopic(topic, env.YOUTUBE_API_KEY, Date.now());
    return { videos, fetchedAt: new Date().toISOString() };
  },
  ["creators-yt-topic-v2"],
  { revalidate: DISCOVERY_TTL, tags: ["creators-youtube"] }
);

const cachedStats = unstable_cache(
  async (topicId: string): Promise<{ stats: LiveStats; at: string }> => {
    const d = await cachedTopic(topicId);
    const stats = await fetchStats(
      d.videos.map((v) => v.id),
      env.YOUTUBE_API_KEY
    );
    return { stats, at: new Date().toISOString() };
  },
  ["creators-yt-stats-v2"],
  { revalidate: STATS_TTL, tags: ["creators-youtube"] }
);

// A failed refresh is not cached by unstable_cache (it throws), so without a
// brake every request after a quota error would retry and burn more quota.
// Per-instance and best-effort, which is enough: the edge header below already
// limits how many requests reach an instance.
const failedUntil = new Map<string, number>();
const FAIL_BACKOFF_MS = 15 * 60_000;

async function loadTopic(id: string): Promise<TopicPayload & { statsAt: string | null }> {
  const until = failedUntil.get(id) ?? 0;
  if (until > Date.now()) throw new YoutubeError("Backing off after a recent YouTube error", 503, "backoff");
  let base: TopicPayload;
  try {
    base = await cachedTopic(id);
  } catch (err) {
    failedUntil.set(id, Date.now() + FAIL_BACKOFF_MS);
    throw err;
  }
  // Live counts are a bonus on top of discovery: if they fail, serve the
  // snapshot (still real numbers, just older) rather than nothing.
  const live = await cachedStats(id).catch(() => null);
  return live ? { videos: withStats(base.videos, live.stats), fetchedAt: base.fetchedAt, statsAt: live.at } : { ...base, statsAt: null };
}

const OK_CACHE = "public, s-maxage=600, stale-while-revalidate=3600";
const ERR_CACHE = "public, s-maxage=600, stale-while-revalidate=1200";

export async function GET(req: Request) {
  try {
    const topicParam = new URL(req.url).searchParams.get("topic") || "all";
    if (topicParam !== "all" && !topicById(topicParam)) return fail("Unknown topic.", 400);

    if (!env.YOUTUBE_API_KEY) {
      return NextResponse.json(
        { configured: false, topic: topicParam, videos: [], fetchedAt: null },
        { headers: { "Cache-Control": ERR_CACHE } }
      );
    }

    const ids = topicParam === "all" ? TOPICS.map((t) => t.id) : [topicParam];
    const settled = await Promise.allSettled(ids.map(loadTopic));
    const good = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
    const firstErr = settled.find((s): s is PromiseRejectedResult => s.status === "rejected")?.reason;

    if (!good.length) {
      const reason = firstErr instanceof YoutubeError ? firstErr.reason : "unknown";
      console.error("[creators:youtube]", reason, firstErr instanceof Error ? firstErr.message : firstErr);
      return NextResponse.json(
        { configured: true, topic: topicParam, videos: [], fetchedAt: null, error: reason === "quotaExceeded" ? "quota" : "upstream" },
        { status: 503, headers: { "Cache-Control": ERR_CACHE } }
      );
    }

    const videos = mergeTopics(good.map((g) => g.videos));
    const fetchedAt = good.map((g) => g.fetchedAt).sort()[0] ?? null; // oldest = honest "as of"
    // Oldest live-stats time across the topics; null if any topic is on its snapshot.
    const statsAt = good.every((g) => g.statsAt) ? (good.map((g) => g.statsAt!).sort()[0] ?? null) : null;
    return NextResponse.json(
      { configured: true, topic: topicParam, videos, fetchedAt, statsAt, partial: good.length < ids.length },
      { headers: { "Cache-Control": good.length < ids.length ? ERR_CACHE : OK_CACHE } }
    );
  } catch (err) {
    return handleError(err, "creators:youtube");
  }
}
