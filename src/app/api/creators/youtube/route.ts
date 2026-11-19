import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { env } from "@/lib/env";
import { handleError, fail } from "@/lib/api";
import { TOPICS, topicById, type YtVideo } from "@modules/creators/lib/scoring";
import { fetchTopic, mergeTopics, YoutubeError } from "@modules/creators/lib/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/creators/youtube?topic=<id|all>
//
// Not polled: the /creators page fetches once per topic switch. Two cache
// layers, and the quota depends on the inner one:
//  - unstable_cache, 12h per topic: the ONLY thing that spends YouTube quota.
//    ~205 units per topic refresh, 7 topics, 2 refreshes/day = under 3,000 of
//    the free 10,000. Visitor traffic cannot move that number.
//  - the edge, s-maxage 1h: keeps repeat visits off the function entirely.
// The result is the reduced video list (tens of kB), well under the data
// cache's 2 MB ceiling, so the cache entry is actually stored.
const TOPIC_TTL = 43_200;

type TopicPayload = { videos: YtVideo[]; fetchedAt: string };

const cachedTopic = unstable_cache(
  async (topicId: string): Promise<TopicPayload> => {
    const topic = topicById(topicId);
    if (!topic) return { videos: [], fetchedAt: new Date().toISOString() };
    const videos = await fetchTopic(topic, env.YOUTUBE_API_KEY, Date.now());
    return { videos, fetchedAt: new Date().toISOString() };
  },
  ["creators-yt-topic-v1"],
  { revalidate: TOPIC_TTL, tags: ["creators-youtube"] }
);

// A failed refresh is not cached by unstable_cache (it throws), so without a
// brake every request after a quota error would retry and burn more quota.
// Per-instance and best-effort, which is enough: the edge header below already
// limits how many requests reach an instance.
const failedUntil = new Map<string, number>();
const FAIL_BACKOFF_MS = 15 * 60_000;

async function loadTopic(id: string): Promise<TopicPayload> {
  const until = failedUntil.get(id) ?? 0;
  if (until > Date.now()) throw new YoutubeError("Backing off after a recent YouTube error", 503, "backoff");
  try {
    return await cachedTopic(id);
  } catch (err) {
    failedUntil.set(id, Date.now() + FAIL_BACKOFF_MS);
    throw err;
  }
}

const OK_CACHE = "public, s-maxage=3600, stale-while-revalidate=43200";
const ERR_CACHE = "public, s-maxage=300, stale-while-revalidate=600";

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
    return NextResponse.json(
      { configured: true, topic: topicParam, videos, fetchedAt, partial: good.length < ids.length },
      { headers: { "Cache-Control": good.length < ids.length ? ERR_CACHE : OK_CACHE } }
    );
  } catch (err) {
    return handleError(err, "creators:youtube");
  }
}
