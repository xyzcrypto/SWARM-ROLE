import "server-only";
import { prisma } from "@/lib/prisma";
import { getCatalog, loadConfig } from "./store";
import { dayKey, levelFor, periodBounds } from "./engine";

/** Days shown in the learning calendar: 26 full weeks, ending today (UTC). */
export const HEAT_DAYS = 26 * 7;
import { badgesFor, BADGES } from "@modules/feedback/lib/shared";

const MODE_LABEL: Record<string, string> = {
  quick: "Quick Quiz", topic: "Topic Challenge", daily: "Daily Challenge", weekly: "Weekly Challenge", advanced: "Advanced", speed: "Speed Run", mistakes: "Mistakes Review", module: "Lesson Check", challenge: "Friend Challenge",
};

/**
 * Everything a public profile shows about a member's learning and feedback.
 * Every query is guarded: before the Academy or Feedback tables exist (a
 * preview deploy against an un-migrated DB) the section is simply empty.
 */
export async function profileActivity(userId: string) {
  const now = Date.now();
  const heatFrom = new Date(periodBounds("daily", now).start - (HEAT_DAYS - 1) * 86_400_000);
  const [profile, cfg, certificates, achievements, achCount, recent, feedback, heatRows, progress, catalog, lastChallenge] = await Promise.all([
    prisma.academyProfile.findUnique({ where: { userId }, select: { xp: true, quizzes: true, answered: true, correct: true, streak: true, bestStreak: true } }).catch(() => null),
    loadConfig().catch(() => null),
    prisma.academyCertificate
      .findMany({ where: { userId, status: "issued" }, orderBy: { issuedAt: "desc" }, take: 6, select: { code: true, title: true, rank: true, issuedAt: true } })
      .catch(() => []),
    prisma.academyAchievement.findMany({ where: { userId }, orderBy: { earnedAt: "desc" }, take: 8, select: { code: true, earnedAt: true } }).catch(() => []),
    prisma.academyAchievement.count({ where: { userId } }).catch(() => 0),
    prisma.academyAttempt
      .findMany({ where: { userId, status: "done" }, orderBy: { finishedAt: "desc" }, take: 5, select: { id: true, mode: true, score: true, correct: true, questionIds: true, finishedAt: true } })
      .catch(() => []),
    prisma.feedback.findMany({ where: { userId }, select: { category: true, status: true } }).catch(() => []),
    // XP per UTC day for the learning calendar. One grouped read on the ledger.
    prisma.$queryRaw<{ d: string; xp: number }[]>`
      SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS d, SUM(amount)::int AS xp
      FROM "AcademyXp" WHERE "userId" = ${userId} AND "createdAt" >= ${heatFrom}
      GROUP BY 1`.catch(() => [] as { d: string; xp: number }[]),
    prisma.academyProgress.findMany({ where: { userId }, select: { moduleId: true } }).catch(() => []),
    getCatalog().catch(() => []),
    // Their most recent quiz anyone can replay as a challenge.
    prisma.academyAttempt
      .findFirst({ where: { userId, status: "done", mode: { notIn: ["daily", "weekly", "mistakes"] } }, orderBy: { finishedAt: "desc" }, select: { id: true, score: true } })
      .catch(() => null),
  ]);
  const titles = new Map((cfg?.achievements ?? []).map((a) => [a.code as string, a.title]));
  const xp = profile?.xp ?? 0;
  const rank = xp > 0 ? await prisma.academyProfile.count({ where: { xp: { gt: xp } } }).then((c) => c + 1).catch(() => null) : null;
  const byDay = new Map(heatRows.map((r) => [r.d, r.xp]));
  const start = periodBounds("daily", now).start - (HEAT_DAYS - 1) * 86_400_000;
  const heat = Array.from({ length: HEAT_DAYS }, (_, i) => {
    const d = dayKey(start + i * 86_400_000);
    return { d, xp: byDay.get(d) ?? 0 };
  });
  const done = new Set(progress.map((p) => p.moduleId));
  const tracks = catalog
    .map((c) => ({ slug: c.slug, title: c.title, icon: c.icon, done: c.modules.filter((m) => done.has(m.id)).length, total: c.modules.length }))
    .filter((t) => t.done > 0)
    .sort((x, y) => y.done / y.total - x.done / x.total || y.done - x.done);
  const level = cfg ? levelFor(xp, cfg.levels) : null;
  const fbBadges = badgesFor(feedback);
  return {
    xp,
    level,
    rank,
    heat,
    activeDays: heat.filter((h) => h.xp > 0).length,
    tracks,
    lessonsDone: done.size,
    challenge: lastChallenge,
    quizzes: profile?.quizzes ?? 0,
    accuracy: profile && profile.answered > 0 ? Math.round((profile.correct / profile.answered) * 100) : null,
    streak: profile?.streak ?? 0,
    bestStreak: profile?.bestStreak ?? 0,
    certificates: certificates.map((c) => ({ ...c, issuedAt: c.issuedAt.toISOString() })),
    achievements: achievements.map((a) => ({ code: a.code, title: titles.get(a.code) ?? a.code, earnedAt: a.earnedAt.toISOString() })),
    achievementCount: achCount,
    recent: recent.map((r) => ({ id: r.id, mode: MODE_LABEL[r.mode] ?? "Quiz", score: r.score, correct: r.correct, total: r.questionIds.length, at: r.finishedAt?.toISOString() ?? null })),
    feedback: {
      count: feedback.length,
      shipped: feedback.filter((f) => f.status === "done").length,
      badges: BADGES.filter((b) => fbBadges.includes(b.code)),
    },
  };
}

export type ProfileActivity = Awaited<ReturnType<typeof profileActivity>>;
