import { prisma } from "@/lib/prisma";
import { ok, fail, handleError } from "@/lib/api";
import { env } from "@/lib/env";
import { checkCronAuth, cronAuthFailure } from "@/core/auth/cron-auth";
import { pushEnabled, sendPush } from "@/lib/push";
import { dayKey, periodBounds } from "@modules/academy/lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/academy/remind - once a day (Vercel Cron, 14:30 UTC = 8 PM IST).
// Learners who kept a streak going yesterday but have not learned today get
// one push: "your N-day streak ends at 5:30 AM". Each learner at most once a
// day (AcademyProfile.remindedDay), only on devices whose notifications are on.
// Secured by CRON_SECRET, like /api/push/dispatch.
const MAX = 1000;

export async function GET(req: Request) {
  try {
    const auth = checkCronAuth(env.CRON_SECRET, req.headers.get("authorization"), new URL(req.url).searchParams.get("secret"));
    if (!auth.ok) {
      const { message, status } = cronAuthFailure(auth.reason);
      return fail(message, status);
    }
    if (!pushEnabled) return ok({ skipped: "push not configured" });

    const now = Date.now();
    const today = dayKey(now);
    const yesterday = dayKey(periodBounds("daily", now).start - 86_400_000);
    const atRisk = await prisma.academyProfile.findMany({
      where: { lastActiveDay: yesterday, streak: { gte: 2 }, OR: [{ remindedDay: null }, { remindedDay: { not: today } }] },
      select: { userId: true, streak: true },
      orderBy: { streak: "desc" },
      take: MAX,
    });
    if (!atRisk.length) return ok({ sent: 0, atRisk: 0 });

    const streakOf = new Map(atRisk.map((p) => [p.userId, p.streak]));
    const subs = await prisma.pushSubscription.findMany({
      where: { userId: { in: [...streakOf.keys()] }, NOT: { notifyMode: "off" } },
      select: { id: true, endpoint: true, p256dh: true, auth: true, userId: true },
    });
    // Mark first, so a retried run never double-sends.
    await prisma.academyProfile.updateMany({ where: { userId: { in: [...streakOf.keys()] } }, data: { remindedDay: today } });

    let sent = 0;
    const dead: string[] = [];
    const results = await Promise.all(
      subs.map((s) => {
        const n = streakOf.get(s.userId as string) ?? 2;
        return sendPush(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          { title: `🔥 Your ${n}-day streak is waiting`, body: "One quick quiz keeps it alive. It resets at 5:30 AM.", url: "/academy/quiz?mode=quick&count=5", tag: `academy-streak-${today}` }
        );
      })
    );
    results.forEach((r, i) => {
      if (r === "ok") sent++;
      else if (r === "gone") dead.push(subs[i].id);
    });
    if (dead.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } });
    return ok({ sent, atRisk: atRisk.length, devices: subs.length, removed: dead.length });
  } catch (err) {
    return handleError(err, "academy:remind");
  }
}
