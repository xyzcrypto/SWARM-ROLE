import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { todayKey } from "@/lib/xp";
import { checkinStreak, streakAtRisk } from "@/lib/xp-streak";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/xp - the signed-in member's total XP + today's already-claimed
// actions, so the client can pre-populate claimed/disabled states without
// guessing (e.g. the Daily Check-in button knows it's already been claimed).
export async function GET() {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);

    const today = todayKey();
    const [user, events, checkins] = await Promise.all([
      prisma.user.findUnique({ where: { id: me.id }, select: { xp: true } }).catch(() => null),
      prisma.xpEvent
        .findMany({ where: { userId: me.id, day: today }, select: { action: true } })
        .catch(() => [] as { action: string }[]),
      // Just the check-in day keys, newest first. The streak is derived from
      // these rather than stored, so there is nothing to keep in sync and
      // nothing to migrate. Capped because a display only needs the run, not
      // the whole history.
      prisma.xpEvent
        .findMany({
          where: { userId: me.id, action: "checkin" },
          select: { day: true },
          orderBy: { day: "desc" },
          take: 400,
        })
        .catch(() => [] as { day: string }[]),
    ]);

    const days = checkins.map((e) => e.day);
    return ok({
      totalXp: user?.xp ?? 0,
      todayActions: events.map((e) => e.action),
      streak: checkinStreak(days, today),
      streakAtRisk: streakAtRisk(days, today),
    });
  } catch (err) {
    return handleError(err, "xp:get");
  }
}
