import "server-only";
import { prisma } from "@/lib/prisma";
import { ACTIVITY_SOURCE, sortActivityBySource, sourceKey } from "./journal-activity";

/**
 * The public Journal Activity feed for one member: their newest `take` rows
 * whose source trade or challenge is STILL public. The only reader of the
 * table; both the profile page and /api/journal/share/activity go through it.
 *
 * Revocation used to be enforced only at write time, so one missed path left a
 * named row readable by anyone for good (Vercel security review, 2026-11-28:
 * a trade made anonymous under the old rule kept its row, and making it private
 * later did not remove it). Checking the source on read closes that whole class,
 * and stale rows found here are deleted so the next read is clean.
 *
 * Throws like any Prisma call; callers keep their un-migrated-table handling.
 */
export async function publicJournalActivity(userId: string, take: number) {
  // Over-fetch so rows hidden below do not shorten the feed.
  const rows = await prisma.journalActivity.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: take * 3,
    select: { id: true, type: true, title: true, win: true, createdAt: true, sourceType: true, sourceId: true },
  });
  const idsOf = (type: string) => [...new Set(rows.flatMap((r) => (r.sourceType === type && r.sourceId ? [r.sourceId] : [])))];
  const tradeIds = idsOf(ACTIVITY_SOURCE.trade);
  const challengeIds = idsOf(ACTIVITY_SOURCE.challenge);
  const [trades, challenges] = await Promise.all([
    // A trade has one owner, so its rows are only ever this member's own.
    tradeIds.length > 0 ? prisma.trade.findMany({ where: { id: { in: tradeIds }, userId }, select: { id: true, visibility: true } }) : Promise.resolve([]),
    // A participant's row points at someone else's challenge: not scoped by user.
    challengeIds.length > 0 ? prisma.challenge.findMany({ where: { id: { in: challengeIds } }, select: { id: true, visibility: true } }) : Promise.resolve([]),
  ]);
  const visibilityOf = new Map<string, string>();
  for (const t of trades) visibilityOf.set(sourceKey(ACTIVITY_SOURCE.trade, t.id), t.visibility);
  for (const c of challenges) visibilityOf.set(sourceKey(ACTIVITY_SOURCE.challenge, c.id), c.visibility);

  const { shown, revoke } = sortActivityBySource(rows, visibilityOf);
  if (revoke.length > 0) {
    await prisma.journalActivity.deleteMany({ where: { id: { in: revoke }, userId } }).catch(() => {}); // best-effort; already hidden
  }
  return shown.slice(0, take).map(({ id, type, title, win, createdAt }) => ({ id, type, title, win, createdAt }));
}
