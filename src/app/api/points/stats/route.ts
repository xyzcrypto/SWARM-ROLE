import { ok, handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { kv } from "@/lib/ai/kv";
import { DEX_REGISTRY } from "@/lib/dex-registry";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * ⚠️ Starts at ZERO, and the key is versioned.
 *
 * This was seeded at `12_400_000` - and worse, the GET wrote that seed INTO
 * Redis the first time it ran. So "$12.4M+ Points Analyzed" was a number
 * nobody had analysed, presented beside three real ones (tracked protocols,
 * active users) in a way that made it read as measured. A fabricated statistic
 * next to genuine ones is the kind of thing that costs trust in all four.
 *
 * `:v2` because the old key is already sitting in production Redis holding the
 * seed plus whatever has accumulated on top of it. Zeroing this constant alone
 * would not have cleaned that up; a new key starts honest without anyone
 * having to run a command by hand.
 */
const ANALYZED_KEY = "points:analyzed:v2";

// In-memory fallback when Redis is not configured. ⚠️ Per-instance and
// therefore near-useless on serverless - each lambda has its own copy. It
// exists so local development shows something, not as a real store.
let inMemoryPointsAnalyzed = 0;

export async function GET() {
  try {
    // 1. Tracked Protocols: Count active protocols with point scenarios
    const activeProtocols = DEX_REGISTRY.filter((p) => Boolean(p.pointValueScenario));
    const trackedProtocols = activeProtocols.length || 3;

    // 2. Active Users: Fetch real registered user count from DB
    let activeUsers = 1;
    try {
      const userCount = await prisma.user.count();
      if (userCount > 0) activeUsers = userCount;
    } catch {
      activeUsers = 1;
    }

    // 3. Points Analyzed: Fetch from Redis KV or fallback memory
    let pointsAnalyzed = inMemoryPointsAnalyzed;
    try {
      const redis = kv();
      if (redis) {
        const val = await redis.get<number>(ANALYZED_KEY);
        // Read only. The old version SEEDED the store on a miss, which is how
        // an invented number became the stored truth.
        if (typeof val === "number" && val > 0) pointsAnalyzed = val;
      }
    } catch {
      // fallback inMemory
    }

    const res = ok({
      trackedProtocols,
      pointsAnalyzed,
      activeUsers,
      updatedAt: new Date().toISOString(),
    });
    res.headers.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=10");
    return res;
  } catch (err) {
    return handleError(err, "points:stats:get");
  }
}

export async function POST(req: Request) {
  try {
    const { success } = await rateLimit("subscribe", clientIp(req));
    if (!success) return ok({ ok: true, rateLimited: true });

    const body = await req.json().catch(() => ({}));
    const points = Number(body?.points);

    // Only accept realistic positive increments (up to 50M per calculation)
    if (Number.isFinite(points) && points > 0) {
      const increment = Math.min(Math.round(points), 50_000_000);
      inMemoryPointsAnalyzed += increment;

      try {
        const redis = kv();
        if (redis) {
          const current = await redis.incrby(ANALYZED_KEY, increment);
          return ok({ success: true, pointsAnalyzed: current });
        }
      } catch {
        // fallback in memory
      }
    }

    return ok({ success: true, pointsAnalyzed: inMemoryPointsAnalyzed });
  } catch (err) {
    return handleError(err, "points:stats:post");
  }
}
