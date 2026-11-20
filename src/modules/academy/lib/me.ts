import "server-only";
import { prisma } from "@/lib/prisma";
import { publicImageUrl } from "@/lib/utils";
import { loadConfig, getCatalog } from "./store";
import { dayKey, levelFor, liveStreak, periodBounds, weekKey } from "./engine";
import { myStanding } from "./board";

/** Everything the personal dashboard shows, in one round trip. */
export async function getMe(userId: string, now = Date.now()) {
  const cfg = await loadConfig();
  const today = dayKey(now);
  const weekAgo = periodBounds("daily", now).start - 6 * 86_400_000;
  const [user, profile, achievements, certificates, progress, active, daily, weekly, ledger, standing, catalog] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, username: true, image: true } }),
    prisma.academyProfile.findUnique({ where: { userId } }),
    prisma.academyAchievement.findMany({ where: { userId }, select: { code: true, earnedAt: true } }),
    prisma.academyCertificate.findMany({
      where: { userId, status: { in: ["issued", "pending"] } },
      orderBy: { issuedAt: "desc" },
      select: { code: true, title: true, kind: true, periodKey: true, rank: true, score: true, status: true, issuedAt: true },
    }),
    prisma.academyProgress.findMany({ where: { userId }, select: { moduleId: true, score: true } }),
    prisma.academyAttempt.findFirst({
      where: { userId, status: "active" },
      orderBy: { startedAt: "desc" },
      select: { id: true, mode: true, current: true, questionIds: true },
    }),
    prisma.academyAttempt.findUnique({ where: { userId_mode_periodKey: { userId, mode: "daily", periodKey: today } }, select: { id: true, status: true, score: true, correct: true, questionIds: true } }),
    prisma.academyAttempt.findUnique({ where: { userId_mode_periodKey: { userId, mode: "weekly", periodKey: weekKey(now) } }, select: { id: true, status: true, score: true, correct: true, questionIds: true } }),
    prisma.academyXp.findMany({ where: { userId, createdAt: { gte: new Date(weekAgo) } }, select: { amount: true, createdAt: true } }),
    myStanding(userId, now),
    getCatalog(),
  ]);

  const xp = profile?.xp ?? 0;
  const done = new Set(progress.map((p) => p.moduleId));
  const totalModules = catalog.reduce((s, c) => s + c.modules.length, 0);

  // Last 7 UTC days of XP, oldest first, zero-filled.
  const week: { day: string; xp: number }[] = [];
  for (let i = 6; i >= 0; i--) week.push({ day: dayKey(periodBounds("daily", now).start - i * 86_400_000), xp: 0 });
  for (const l of ledger) {
    const d = week.find((w) => w.day === dayKey(l.createdAt.getTime()));
    if (d) d.xp += l.amount;
  }

  // Continue learning: the first unfinished lesson in the first topic you have
  // started, else the first unfinished lesson anywhere.
  const started = catalog.find((c) => c.modules.some((m) => done.has(m.id)) && c.modules.some((m) => !done.has(m.id)));
  const pickFrom = started ? [started] : catalog;
  let next: { category: string; categorySlug: string; module: string; moduleSlug: string; level: string; minutes: number } | null = null;
  for (const c of pickFrom) {
    const m = c.modules.find((x) => !done.has(x.id));
    if (m) {
      next = { category: c.title, categorySlug: c.slug, module: m.title, moduleSlug: m.slug, level: m.level, minutes: m.minutes };
      break;
    }
  }

  return {
    user: user ? { id: user.id, name: user.name?.trim() || (user.username ? `@${user.username}` : "Learner"), username: user.username, image: publicImageUrl(user.image, user.id) } : null,
    xp,
    level: levelFor(xp, cfg.levels),
    levels: cfg.levels,
    streak: liveStreak(profile?.lastActiveDay, profile?.streak ?? 0, today),
    bestStreak: profile?.bestStreak ?? 0,
    learnedToday: profile?.lastActiveDay === today,
    quizzes: profile?.quizzes ?? 0,
    answered: profile?.answered ?? 0,
    accuracy: profile?.answered ? Math.round(((profile?.correct ?? 0) / profile.answered) * 100) : null,
    week,
    standing,
    achievements: cfg.achievements
      .filter((a) => a.enabled)
      .map((a) => {
        const got = achievements.find((x) => x.code === a.code);
        return { code: a.code, title: a.title, description: a.description, icon: a.icon, xp: a.xp, earnedAt: got ? got.earnedAt.toISOString() : null };
      }),
    certificates: certificates.map((c) => ({ ...c, issuedAt: c.issuedAt.toISOString() })),
    progress: {
      done: done.size,
      total: totalModules,
      byCategory: catalog.map((c) => ({ slug: c.slug, done: c.modules.filter((m) => done.has(m.id)).length, total: c.modules.length })),
      modules: [...done],
    },
    active: active ? { id: active.id, mode: active.mode, at: active.current + 1, total: active.questionIds.length } : null,
    daily: daily ? { id: daily.id, status: daily.status, score: daily.score, correct: daily.correct, total: daily.questionIds.length } : null,
    weekly: weekly ? { id: weekly.id, status: weekly.status, score: weekly.score, correct: weekly.correct, total: weekly.questionIds.length } : null,
    next,
    awards: cfg.awards,
    serverNow: now,
  };
}

export type AcademyMe = Awaited<ReturnType<typeof getMe>>;
