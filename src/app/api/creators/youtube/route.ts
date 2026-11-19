import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { env } from "@/lib/env";
import { handleError, fail } from "@/lib/api";
import { TOPICS, topicById, type YtVideo } from "@modules/creators/lib/scoring";
import { classify, fetchStats, fetchTopic, withStats, YoutubeError, type LiveStats } from "@modules/creators/lib/youtube";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/creators/youtube?topic=<id|all>
//
// Polled by /creators every YT_POLL_MS (540s) while the tab is visible, and
// listed in markets-poll-alignment.test.ts TARGETS. Layers, outermost first:
//  - the edge, s-maxage 600: repeat visits never reach the function.
//  - LIVE STATS, unstable_cache 20 min per topic: videos.list on the relevant
//    ids (1 unit per 50, ~3-6 units a topic) - views/likes/comments stay
//    current. ~72 refreshes/day x 10 topics x ~4 units = ~2,900 units.
//  - DISCOVERY, unstable_cache 24h per topic, backed by the YtDiscovery table:
//    the search calls (100 units each) that find which videos exist. A DB row
//    younger than 24h is reused as-is, so deploys and cache-key changes cost
//    no quota; a YouTube error or exhausted quota serves the last good row
//    instead of an empty tab. ~4,500 units/day when every topic refreshes.
// Relevance is applied at read time (classify -> topicsFor), title first, and
// every video is tagged with every venue it is about - so a rule change needs
// no new searches, and a Hyperliquid video found by the "perp dex" search
// still counts for Hyperliquid.
const DISCOVERY_TTL = 86_400;
const STATS_TTL = 1_200;

type TopicPayload = { videos: YtVideo[]; fetchedAt: string; stale: boolean };

async function discover(topicId: string): Promise<TopicPayload> {
  const topic = topicById(topicId);
  if (!topic) return { videos: [], fetchedAt: new Date().toISOString(), stale: false };
  const row = await prisma.ytDiscovery.findUnique({ where: { topic: topicId } }).catch(() => null);
  const rowVideos = (row?.videos as unknown as YtVideo[] | undefined) ?? null;
  if (row && rowVideos && Date.now() - row.fetchedAt.getTime() < DISCOVERY_TTL * 1000) {
    return { videos: rowVideos, fetchedAt: row.fetchedAt.toISOString(), stale: false };
  }
  try {
    const videos = await fetchTopic(topic, env.YOUTUBE_API_KEY, Date.now());
    const now = new Date();
    await prisma.ytDiscovery
      .upsert({
        where: { topic: topicId },
        create: { topic: topicId, videos: videos as unknown as object, fetchedAt: now },
        update: { videos: videos as unknown as object, fetchedAt: now },
      })
      .catch((e) => console.error("[creators:youtube] save", e instanceof Error ? e.message : e));
    return { videos, fetchedAt: now.toISOString(), stale: false };
  } catch (err) {
    // Last good data beats an empty tab. Marked stale so the page can say so.
    if (rowVideos) return { videos: rowVideos, fetchedAt: row!.fetchedAt.toISOString(), stale: true };
    throw err;
  }
}

const cachedTopic = unstable_cache(discover, ["creators-yt-topic-v3"], { revalidate: DISCOVERY_TTL, tags: ["creators-youtube"] });

const cachedStats = unstable_cache(
  async (topicId: string): Promise<{ stats: LiveStats; at: string }> => {
    const d = await cachedTopic(topicId);
    // Only the videos that will actually be shown.
    const ids = classify([d.videos]).map((v) => v.id);
    const stats = await fetchStats(ids, env.YOUTUBE_API_KEY);
    return { stats, at: new Date().toISOString() };
  },
  ["creators-yt-stats-v3"],
  { revalidate: STATS_TTL, tags: ["creators-youtube"] }
);

// A failed refresh with no stored fallback is not cached by unstable_cache (it
// throws), so without a brake every request would retry and burn more quota.
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
  return live ? { ...base, videos: withStats(base.videos, live.stats), statsAt: live.at } : { ...base, statsAt: null };
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

    // Tag every video with every venue it is about, then keep the ones about
    // the requested venue (or any venue, for "all").
    const videos = classify(good.map((g) => g.videos)).filter((v) => topicParam === "all" || v.topics.includes(topicParam as never));
    const fetchedAt = good.map((g) => g.fetchedAt).sort()[0] ?? null; // oldest = honest "as of"
    // Oldest live-stats time across the topics; null if any topic is on its snapshot.
    const statsAt = good.every((g) => g.statsAt) ? (good.map((g) => g.statsAt!).sort()[0] ?? null) : null;
    return NextResponse.json(
      { configured: true, topic: topicParam, videos, fetchedAt, statsAt, partial: good.length < ids.length, stale: good.some((g) => g.stale) },
      { headers: { "Cache-Control": good.length < ids.length ? ERR_CACHE : OK_CACHE } }
    );
  } catch (err) {
    return handleError(err, "creators:youtube");
  }
}
