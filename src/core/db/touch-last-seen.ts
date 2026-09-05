import { prisma } from "@core/db/prisma";

// In-memory throttle map: remember when each user's lastSeenAt was last touched.
// Limits DB updates to at most once every 2 minutes per user, avoiding hundreds
// of redundant PostgreSQL row updates from frequent 25s presence heartbeats.
const lastTouched = new Map<string, number>();
const TOUCH_THROTTLE_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Record that this user was here, for the DM "last seen" line.
 *
 * Called only from endpoints the site ALREADY hits - the site-wide presence
 * heartbeat and the pagehide beacon - so it adds no requests of its own, only a
 * column write alongside a write that was happening anyway.
 *
 * Never throws and never blocks the caller's real work: a `lastSeenAt` that is
 * a few minutes stale is a cosmetic loss, and a database that has not had the
 * column pushed yet must not take the presence endpoint (and with it every
 * page's heartbeat) down with it.
 */
export async function touchLastSeen(userId: string, force = false): Promise<void> {
  const now = Date.now();
  const prev = lastTouched.get(userId) ?? 0;
  if (!force && now - prev < TOUCH_THROTTLE_MS) return;

  lastTouched.set(userId, now);
  if (lastTouched.size > 10_000) lastTouched.clear();

  await prisma.user
    .update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
    .catch(() => null);
}
