import { NextResponse, after } from "next/server";
import { unstable_cache } from "next/cache";
import { env } from "@/lib/env";
import { handleError, fail } from "@/lib/api";
import { TOPICS, topicById, type YtVideo } from "@modules/creators/lib/scoring";
import { classify, fetchStats, fetchTopic, nextQuotaReset, withStats, YoutubeError, type LiveStats } from "@modules/creators/lib/youtube";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// First-time discovery of one venue runs inline; refreshes run in after().
export const maxDuration = 60;

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

const memo = new Map<string, { at: number; v: Stored }>();
type Stored = { videos: YtVideo[]; fetchedAt: string; fresh: boolean };

/** What is stored for a topic (memo -> DB). Never calls YouTube. */
async function readStored(topicId: string): Promise<Stored | null> {
  const m = memo.get(topicId);
  if (m && Date.now() - m.at < 5 * 60_000) return m.v;
  const row = await prisma.ytDiscovery.findUnique({ where: { topic: topicId } }).catch(() => null);
  if (!row) return null;
  const v = { videos: row.videos as unknown as YtVideo[], fetchedAt: row.fetchedAt.toISOString(), fresh: Date.now() - row.fetchedAt.getTime() < DISCOVERY_TTL_MS };
  memo.set(topicId, { at: Date.now(), v });
  return v;
}

/**
 * Run one topic's discovery against YouTube and store it. Guarded: skipped
 * while the quota is out, and only one caller per topic at a time.
 */
async function refresh(topicId: string): Promise<Stored | null> {
  const topic = topicById(topicId);
  if (!topic) return null;
  if (await quotaResetAt()) throw new YoutubeError("YouTube quota exhausted", 403, "quotaExceeded");
  if (!(await claim(topicId))) throw new YoutubeError("Discovery in progress", 503, "busy");
  try {
    const videos = await fetchTopic(topic, env.YOUTUBE_API_KEY, Date.now());
    const now = new Date();
    await prisma.ytDiscovery.upsert({
      where: { topic: topicId },
      create: { topic: topicId, videos: videos as unknown as object, fetchedAt: now },
      update: { videos: videos as unknown as object, fetchedAt: now },
    });
    const v = { videos, fetchedAt: now.toISOString(), fresh: true };
    memo.set(topicId, { at: Date.now(), v });
    return v;
  } catch (err) {
    await noteQuota(err);
    console.error("[creators:youtube] discovery", topicId, err instanceof YoutubeError ? err.reason : "", err instanceof Error ? err.message : err);
    throw err;
  }
}

/** Background refresh of up to `max` topics, missing ones first. Never throws. */
async function refreshInBackground(topicIds: string[], max = 3) {
  for (const id of topicIds.slice(0, max)) {
    try {
      await refresh(id);
    } catch (err) {
      if (err instanceof YoutubeError && err.reason === "quotaExceeded") return;
    }
  }
}

const cachedStats = unstable_cache(
  async (topicId: string): Promise<{ stats: LiveStats; at: string }> => {
    if (await quotaResetAt()) throw new YoutubeError("YouTube quota exhausted", 403, "quotaExceeded");
    const d = await readStored(topicId);
    if (!d) throw new YoutubeError("Nothing stored yet", 503, "pending");
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

const OK_CACHE = "public, s-maxage=600, stale-while-revalidate=3600";
// Anything short of a complete answer is not edge-cached: a "still fetching"
// or error response pinned for 10 minutes is exactly what kept the tab empty.
const NO_STORE = "private, no-store";

export async function GET(req: Request) {
  try {
    const topicParam = new URL(req.url).searchParams.get("topic") || "all";
    if (topicParam !== "all" && !topicById(topicParam)) return fail("Unknown topic.", 400);

    if (!env.YOUTUBE_API_KEY) {
      return NextResponse.json({ configured: false, topic: topicParam, videos: [], fetchedAt: null }, { headers: { "Cache-Control": NO_STORE } });
    }

    const ids = topicParam === "all" ? TOPICS.map((t) => t.id) : [topicParam];
    const stored = await Promise.all(ids.map(async (id) => [id, await readStored(id)] as const));
    let firstErr: unknown = null;

    // One venue with nothing stored: fetch it now (a few seconds, inside
    // maxDuration). "All" never fetches inline - ten venues at once is what
    // used to time the request out and burn quota without saving anything.
    if (topicParam !== "all" && !stored[0]![1]) {
      try {
        stored[0] = [topicParam, await refresh(topicParam)];
      } catch (err) {
        firstErr = err;
      }
    }

    // Old or missing venues are fetched after the response is sent.
    const todo = [...stored.filter(([, v]) => !v).map(([id]) => id), ...stored.filter(([, v]) => v && !v.fresh).map(([id]) => id)];
    if (todo.length && !(await quotaResetAt())) after(() => refreshInBackground(todo));

    const have = stored.filter((x): x is readonly [string, Stored] => !!x[1]);
    const pending = stored.filter(([, v]) => !v).map(([id]) => id);
    const reset = await quotaResetAt();

    if (!have.length) {
      // With the daily-quota guard on, no background fetch was scheduled, so
      // "pending" would make the page spin and retry for nothing.
      const reason =
        firstErr instanceof YoutubeError ? firstErr.reason : firstErr ? "unknown" : reset ? "quotaExceeded" : "pending";
      if (firstErr) console.error("[creators:youtube]", reason, firstErr instanceof Error ? firstErr.message : firstErr);
      return NextResponse.json(
        {
          configured: true,
          topic: topicParam,
          videos: [],
          fetchedAt: null,
          // "pending" = first fetch is running in the background; the page retries shortly.
          pending: reason === "pending" || reason === "busy",
          error: reset || reason === "quotaExceeded" ? "quota" : reason === "pending" || reason === "busy" ? "busy" : "upstream",
          quotaResetAt: reset ? new Date(reset).toISOString() : null,
          // The API's own reason (e.g. keyInvalid, accessNotConfigured), shown on the page.
          reason,
          detail: firstErr instanceof Error ? firstErr.message.slice(0, 160) : null,
        },
        { status: reason === "pending" || reason === "busy" ? 202 : 503, headers: { "Cache-Control": NO_STORE } }
      );
    }

    // Live counts on top of the stored lists (cached 30 min; skipped while the quota is out).
    const live = reset ? [] : await Promise.all(have.map(([id]) => cachedStats(id).catch(() => null)));
    const lists = have.map(([, v], i) => (live[i] ? withStats(v.videos, live[i]!.stats) : v.videos));
    // Tag every video with every venue it is about, then keep the ones about
    // the requested venue (or any venue, for "all").
    const videos = classify(lists).filter((v) => topicParam === "all" || v.topics.includes(topicParam as never));
    const fetchedAt = have.map(([, v]) => v.fetchedAt).sort()[0] ?? null; // oldest = honest "as of"
    const statsAt = live.length === have.length && live.every(Boolean) ? (live.map((l) => l!.at).sort()[0] ?? null) : null;
    const complete = !pending.length;
    return NextResponse.json(
      {
        configured: true,
        topic: topicParam,
        videos,
        fetchedAt,
        statsAt,
        partial: !complete,
        pending: !complete,
        stale: have.some(([, v]) => !v.fresh),
        quotaResetAt: reset ? new Date(reset).toISOString() : null,
      },
      { headers: { "Cache-Control": complete ? OK_CACHE : NO_STORE } }
    );
  } catch (err) {
    return handleError(err, "creators:youtube");
  }
}
