import { prisma } from "@core/db/prisma";

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
export async function touchLastSeen(userId: string): Promise<void> {
  await prisma.user
    .update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
    .catch(() => null);
}
