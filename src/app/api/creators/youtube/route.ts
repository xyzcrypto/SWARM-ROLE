import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { env } from "@/lib/env";
import { handleError, fail } from "@/lib/api";
import { TOPICS, topicById, type YtVideo } from "@modules/creators/lib/scoring";
import { classify, fetchStats, fetchTopic, nextQuotaReset, withStats, YoutubeError, type LiveStats } from "@modules/creators/lib/youtube";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/creators/youtube?topic=<id|all>
//
// Polled by /creators every YT_POLL_MS (540s) while the tab is visible, and
// listed in markets-poll-alignment.test.ts TARGETS. Layers, outermost first:
//  - the edge, s-maxage 600: repeat visits never reach the function.
//  - LIVE STATS, unstable_cache 30 min per topic: videos.list on the shown
//    ids (1 unit per 50) - views/likes/comments stay current.
//  - DISCOVERY, the YtDiscovery table (+ a 5-minute in-memory copy): the
//    search calls (100 units each) that find which videos exist, at most once
//    a day per topic. ~205 units a topic (Variational ~405, Entropy ~305).
// Quota safety - YouTube's free 10,000 units/day DID run out:
//  - QUOTA GUARD: when YouTube answers quotaExceeded, no further YouTube call
//    is made until its reset (midnight Pacific); stored data is served and the
//    page says when fresh numbers return.
//  - one discovery per topic at a time (a DB lock row), so parallel instances
//    cannot pay for the same search twice.
//  - discovery is never kept in unstable_cache: a stale fallback cached there
//    would have outlived the quota reset by up to a day.
// Relevance is applied at read time (classify -> topicsFor), title first, and
// every video is tagged with every venue it is about.
const DISCOVERY_TTL_MS = 86_400_000;
const STATS_TTL = 1_800;
const LOCK_MS = 5 * 60_000;

type TopicPayload = { videos: YtVideo[]; fetchedAt: string; stale: boolean };

async function quotaResetAt(): Promise<number | null> {
  const row = await prisma.creatorSync.findUnique({ where: { key: "yt-quota" } }).catch(() => null);
  return row && row.runAt.getTime() > Date.now() ? row.runAt.getTime() : null;
}
async function noteQuota(err: unknown) {
  if (err instanceof YoutubeError && (err.reason === "quotaExceeded" || err.reason === "dailyLimitExceeded" || err.reason === "rateLimitExceeded")) {
    const until = new Date(nextQuotaReset(Date.now()));
    await prisma.creatorSync
      .upsert({ where: { key: "yt-quota" }, create: { key: "yt-quota", runAt: until }, update: { runAt: until } })
      .catch(() => null);
  }
}
/** True for the one caller that gets to run this topic's discovery now. */
async function claim(topicId: string): Promise<boolean> {
  const key = `ytdisc:${topicId}`;
  await prisma.creatorSync.upsert({ where: { key }, create: { key, runAt: new Date(0) }, update: {} }).catch(() => null);
  const r = await prisma.creatorSync
    .updateMany({ where: { key, runAt: { lt: new Date(Date.now() - LOCK_MS) } }, data: { runAt: new Date() } })
    .catch(() => ({ count: 0 }));
  return r.count === 1;
}

const memo = new Map<string, { at: number; v: TopicPayload }>();

async function discover(topicId: string): Promise<TopicPayload> {
  const m = memo.get(topicId);
  if (m && Date.now() - m.at < 5 * 60_000) return m.v;
  const topic = topicById(topicId);
  if (!topic) return { videos: [], fetchedAt: new Date().toISOString(), stale: false };
  const row = await prisma.ytDiscovery.findUnique({ where: { topic: topicId } }).catch(() => null);
  const rowVideos = (row?.videos as unknown as YtVideo[] | undefined) ?? null;
  const stored = rowVideos ? { videos: rowVideos, fetchedAt: row!.fetchedAt.toISOString() } : null;
  const keep = (v: TopicPayload) => (memo.set(topicId, { at: Date.now(), v }), v);
  if (stored && Date.now() - row!.fetchedAt.getTime() < DISCOVERY_TTL_MS) return keep({ ...stored, stale: false });

  const reset = await quotaResetAt();
  if (reset) {
    if (stored) return keep({ ...stored, stale: true });
    throw new YoutubeError("YouTube quota exhausted", 403, "quotaExceeded");
  }
  if (!(await claim(topicId))) {
    // Someone else is fetching this topic right now: serve what we have.
    if (stored) return { ...stored, stale: true };
    throw new YoutubeError("Discovery in progress", 503, "busy");
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
    return keep({ videos, fetchedAt: now.toISOString(), stale: false });
  } catch (err) {
    await noteQuota(err);
    console.error("[creators:youtube] discovery", topicId, err instanceof YoutubeError ? err.reason : "", err instanceof Error ? err.message : err);
    if (stored) return keep({ ...stored, stale: true });
    throw err;
  }
}

const cachedStats = unstable_cache(
  async (topicId: string): Promise<{ stats: LiveStats; at: string }> => {
    if (await quotaResetAt()) throw new YoutubeError("YouTube quota exhausted", 403, "quotaExceeded");
    const d = await discover(topicId);
    // Only the videos that will actually be shown.
    const ids = classify([d.videos]).map((v) => v.id);
    try {
      const stats = await fetchStats(ids, env.YOUTUBE_API_KEY);
      return { stats, at: new Date().toISOString() };
    } catch (err) {
      await noteQuota(err);
      throw err;
    }
  },
  ["creators-yt-stats-v4"],
  { revalidate: STATS_TTL, tags: ["creators-youtube"] }
);

async function loadTopic(id: string): Promise<TopicPayload & { statsAt: string | null }> {
  const base = await discover(id);
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
      const reset = await quotaResetAt();
      return NextResponse.json(
        {
          configured: true,
          topic: topicParam,
          videos: [],
          fetchedAt: null,
          error: reset || reason === "quotaExceeded" ? "quota" : reason === "busy" ? "busy" : "upstream",
          // Shown to visitors as "fresh data returns in N hours".
          quotaResetAt: reset ? new Date(reset).toISOString() : null,
          // The API's own reason (e.g. keyInvalid, accessNotConfigured), so a
          // setup problem is visible on the page instead of only in logs.
          reason,
        },
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
      {
        configured: true,
        topic: topicParam,
        videos,
        fetchedAt,
        statsAt,
        partial: good.length < ids.length,
        stale: good.some((g) => g.stale),
        quotaResetAt: (await quotaResetAt().then((r) => (r ? new Date(r).toISOString() : null))) ?? null,
      },
      { headers: { "Cache-Control": good.length < ids.length ? ERR_CACHE : OK_CACHE } }
    );
  } catch (err) {
    return handleError(err, "creators:youtube");
  }
}
