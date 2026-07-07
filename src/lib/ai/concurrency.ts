// Per-user AI concurrency guard: caps how many AI requests one member can have
// in flight at once (abuse/cost protection). Redis-backed when available, with a
// short TTL so a crashed request can't hold a slot forever. Fail-open — when
// Upstash isn't configured it always grants (best-effort, like the rate-limiter).
import { kv } from "./kv";

const PREFIX = "xyz:ai:conc:";
const MAX_CONCURRENT = 2;
const TTL_SECONDS = 60; // safety expiry per in-flight slot

export type Slot = { release: () => Promise<void> };

const NOOP_SLOT: Slot = { release: async () => {} };

/** Acquire a slot, or null if the member is already at the concurrency cap. */
export async function acquireSlot(userId: string): Promise<Slot | null> {
  const redis = kv();
  if (!redis) return NOOP_SLOT; // fail open
  const key = `${PREFIX}${userId}`;
  try {
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, TTL_SECONDS);
    if (n > MAX_CONCURRENT) {
      await redis.decr(key).catch(() => {});
      return null;
    }
    let released = false;
    return {
      release: async () => {
        if (released) return;
        released = true;
        await redis.decr(key).catch(() => {});
      },
    };
  } catch {
    return NOOP_SLOT; // fail open on any Redis error
  }
}
