import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { todayKey } from "@/lib/xp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/xp - the signed-in member's total XP + today's already-claimed
// actions, so the client can pre-populate claimed/disabled states without
// guessing (e.g. the Daily Check-in button knows it's already been claimed).
export async function GET() {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);

    const [user, events] = await Promise.all([
      prisma.user.findUnique({ where: { id: me.id }, select: { xp: true } }).catch(() => null),
      prisma.xpEvent
        .findMany({ where: { userId: me.id, day: todayKey() }, select: { action: true } })
        .catch(() => [] as { action: string }[]),
    ]);

    return ok({ totalXp: user?.xp ?? 0, todayActions: events.map((e) => e.action) });
  } catch (err) {
    return handleError(err, "xp:get");
  }
}
