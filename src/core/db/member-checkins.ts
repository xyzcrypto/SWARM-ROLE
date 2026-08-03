import { prisma } from "@core/db/prisma";
import { checkinStreak } from "@shared/utils/xp-streak";

/** What the dashboard shows per member: the run, and how many days in total. */
export type MemberCheckins = { streak: number; total: number };

/**
 * How far back the run is reconstructed. Matches the cap the member's own
 * check-in button uses, so the two never disagree - a dashboard that says
 * "Day 40" while the member sees "Day 41" is worse than no number.
 */
const STREAK_WINDOW_DAYS = 400;

/**
 * Check-in totals and current streaks for a set of members, in two queries
 * rather than one per row.
 *
 * Both come from `XpEvent`, which already records one row per user, per action,
 * per UTC day - so there is nothing to store and nothing to keep in sync. The
 * total is an all-time count (a `groupBy`, which never loads the rows); the
 * streak needs the actual day keys, so that read is bounded by the window
 * above and by the `action: "checkin"` filter, both of which sit on the
 * `[userId, action, day]` unique index.
 *
 * Returns an empty map rather than throwing: a members list must still render
 * on a database where this is unavailable, and a missing streak column is a
 * cosmetic loss.
 */
export async function memberCheckins(userIds: string[], today: string): Promise<Map<string, MemberCheckins>> {
  const out = new Map<string, MemberCheckins>();
  if (userIds.length === 0) return out;

  const since = new Date(Date.now() - STREAK_WINDOW_DAYS * 864e5).toISOString().slice(0, 10);

  const [totals, days] = await Promise.all([
    prisma.xpEvent
      .groupBy({ by: ["userId"], where: { userId: { in: userIds }, action: "checkin" }, _count: { _all: true } })
      .catch(() => [] as { userId: string; _count: { _all: number } }[]),
    prisma.xpEvent
      .findMany({
        where: { userId: { in: userIds }, action: "checkin", day: { gte: since } },
        select: { userId: true, day: true },
      })
      .catch(() => [] as { userId: string; day: string }[]),
  ]);

  const byUser = new Map<string, string[]>();
  for (const row of days) {
    const list = byUser.get(row.userId);
    if (list) list.push(row.day);
    else byUser.set(row.userId, [row.day]);
  }

  for (const id of userIds) {
    out.set(id, {
      streak: checkinStreak(byUser.get(id) ?? [], today),
      total: totals.find((t) => t.userId === id)?._count._all ?? 0,
    });
  }
  return out;
}
