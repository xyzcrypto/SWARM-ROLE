import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { XP_ACTIONS, XP_VALUES, todayKey } from "@/lib/xp";
import { checkinStreak } from "@/lib/xp-streak";
import { broadcastEvent, userChannel } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const awardSchema = z.object({
  action: z.enum(XP_ACTIONS as [string, ...string[]]),
});

// POST /api/xp/award - award 1 XP for `action`, once per user per UTC day.
// Idempotent: a repeat call for an action already claimed today is a no-op
// (not an error) - the client can fire this optimistically without checking
// GET /api/xp first.
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    const { success } = await rateLimit("xp", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = awardSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid action.", 400);
    const action = parsed.data.action as (typeof XP_ACTIONS)[number];
    const day = todayKey();
    const amount = XP_VALUES[action];

    // Only the check-in has a run worth reporting; the other actions are
    // one-offs, and querying their history on every award would be waste.
    const streakOf = async () =>
      action !== "checkin"
        ? null
        : checkinStreak(
            (
              await prisma.xpEvent
                .findMany({ where: { userId: me.id, action: "checkin" }, select: { day: true }, orderBy: { day: "desc" }, take: 400 })
                .catch(() => [] as { day: string }[])
            ).map((e) => e.day),
            day
          );

    try {
      const [, user] = await prisma.$transaction([
        prisma.xpEvent.create({ data: { userId: me.id, action, day, xp: amount } }),
        prisma.user.update({ where: { id: me.id }, data: { xp: { increment: amount } }, select: { xp: true } }),
      ]);
      const streak = await streakOf();
      // Tell this member's OTHER open tabs and devices. Checking in on a phone
      // should not leave the laptop showing yesterday's number until it is
      // reloaded. Same public per-user channel as the DM pings, so it carries
      // nothing but the streak - which is the member's own, and already on
      // their screen.
      if (action === "checkin") {
        await broadcastEvent(userChannel(me.id), "xp_checkin", { streak, totalXp: user.xp });
      }
      return ok({ awarded: true, totalXp: user.xp, streak });
    } catch (err) {
      // Already claimed today (unique userId+action+day) - graceful no-op.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const user = await prisma.user.findUnique({ where: { id: me.id }, select: { xp: true } }).catch(() => null);
        return ok({ awarded: false, totalXp: user?.xp ?? 0, streak: await streakOf() });
      }
      throw err;
    }
  } catch (err) {
    return handleError(err, "xp:award");
  }
}
