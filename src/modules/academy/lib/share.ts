import "server-only";
import { prisma } from "@/lib/prisma";
import { publicImageUrl } from "@/lib/utils";
import { challengeSummary } from "./quiz";
import { myStanding } from "./board";
import { loadConfig } from "./store";
import { levelFor } from "./engine";

export const PERIODS = ["daily", "weekly", "monthly", "alltime"] as const;
export type SharePeriod = (typeof PERIODS)[number];
export const PERIOD_LABEL: Record<SharePeriod, string> = { daily: "Today", weekly: "This week", monthly: "This month", alltime: "All time" };
export const parsePeriod = (p: string | null | undefined): SharePeriod => ((PERIODS as readonly string[]).includes(p ?? "") ? (p as SharePeriod) : "weekly");

const MODE_LABEL: Record<string, string> = {
  quick: "Quick Quiz",
  topic: "Topic Challenge",
  daily: "Daily Challenge",
  weekly: "Weekly Challenge",
  advanced: "Advanced Challenge",
  speed: "Speed Run",
  mistakes: "Mistakes Review",
  module: "Lesson Check",
  challenge: "Friend Challenge",
};

/** A finished quiz, for its share card and page. Null if missing or unfinished. */
export async function quizShare(id: string) {
  const s = await challengeSummary(id).catch(() => null);
  if (!s) return null;
  const accuracy = s.total ? Math.round((s.correct / s.total) * 100) : 0;
  return { ...s, accuracy, modeLabel: MODE_LABEL[s.mode] ?? "Quiz" };
}

/** A member's public leaderboard standing (the leaderboard is public). */
export async function rankShare(handle: string, period: SharePeriod) {
  const h = handle.replace(/^@/, "").toLowerCase();
  const user = await prisma.user.findFirst({ where: { username: h }, select: { id: true, name: true, username: true, image: true } });
  if (!user) return null;
  const [standing, profile, cfg] = await Promise.all([
    myStanding(user.id),
    prisma.academyProfile.findUnique({ where: { userId: user.id }, select: { xp: true, streak: true, quizzes: true } }),
    loadConfig(),
  ]);
  const st = standing[period];
  const level = levelFor(profile?.xp ?? 0, cfg.levels);
  return {
    name: user.name?.trim() || `@${user.username}`,
    username: user.username!,
    image: publicImageUrl(user.image, user.id),
    rank: st?.rank ?? null,
    size: st?.size ?? 0,
    periodXp: st?.xp ?? 0,
    totalXp: profile?.xp ?? 0,
    streak: profile?.streak ?? 0,
    quizzes: profile?.quizzes ?? 0,
    level,
  };
}
