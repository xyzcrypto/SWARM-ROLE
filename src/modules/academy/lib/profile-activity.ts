import "server-only";
import { prisma } from "@/lib/prisma";
import { loadConfig } from "./store";
import { levelFor } from "./engine";
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
  const [profile, cfg, certificates, achievements, achCount, recent, feedback] = await Promise.all([
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
  ]);
  const titles = new Map((cfg?.achievements ?? []).map((a) => [a.code as string, a.title]));
  const xp = profile?.xp ?? 0;
  const level = cfg ? levelFor(xp, cfg.levels) : null;
  const fbBadges = badgesFor(feedback);
  return {
    xp,
    level,
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
