import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { broadcastEvent } from "@/lib/realtime";
import { CH_ACADEMY } from "@/lib/realtime-channels";
import { CATEGORY_ACHIEVEMENTS, type AchievementCode, type AcademyConfigShape } from "./config";
import { levelFor } from "./engine";

type Tx = Prisma.TransactionClient;

/** "Top 10" needs at least this many ranked learners to mean anything. */
const TOP10_MIN_FIELD = 30;

export type Grant = { userId: string; amount: number; reason: string; key: string; label: string };

/**
 * Write one ledger row and move the member's total, exactly once per `key`.
 *
 * `createMany({ skipDuplicates })` rather than `create` + catch: inside an
 * interactive transaction a unique violation aborts the whole transaction in
 * Postgres, while ON CONFLICT DO NOTHING just reports 0 rows. 0 rows means this
 * reward was already paid, so the total is left alone.
 */
export async function grant(tx: Tx, g: Grant): Promise<number> {
  if (g.amount <= 0) return 0;
  const { count } = await tx.academyXp.createMany({
    data: [{ userId: g.userId, amount: g.amount, reason: g.reason, key: g.key, label: g.label.slice(0, 120) }],
    skipDuplicates: true,
  });
  if (!count) return 0;
  await tx.academyProfile.upsert({
    where: { userId: g.userId },
    create: { userId: g.userId, xp: g.amount },
    update: { xp: { increment: g.amount } },
  });
  return g.amount;
}

/** XP already earned today from quizzes, for the anti-farming daily cap. */
export async function quizXpToday(tx: Tx, userId: string, dayStart: number): Promise<number> {
  const r = await tx.academyXp.aggregate({
    where: { userId, reason: { in: ["quiz"] }, createdAt: { gte: new Date(dayStart) } },
    _sum: { amount: true },
  });
  return r._sum.amount ?? 0;
}

export type Unlocked = { code: AchievementCode; title: string; xp: number };

/**
 * Check every achievement and pay the ones newly earned. Safe to call as often
 * as you like: AcademyAchievement's primary key and the ledger key make each
 * unlock happen once.
 */
export async function checkAchievements(userId: string, cfg: AcademyConfigShape): Promise<Unlocked[]> {
  const enabled = cfg.achievements.filter((a) => a.enabled);
  if (!enabled.length) return [];
  const [have, profile] = await Promise.all([
    prisma.academyAchievement.findMany({ where: { userId }, select: { code: true } }),
    prisma.academyProfile.findUnique({ where: { userId } }),
  ]);
  const owned = new Set(have.map((h) => h.code));
  const todo = enabled.filter((a) => !owned.has(a.code));
  if (!todo.length || !profile) return [];

  const need = (c: AchievementCode) => todo.some((a) => a.code === c);
  const earned = new Set<AchievementCode>();
  if (need("first_quiz") && profile.quizzes >= 1) earned.add("first_quiz");
  if (need("answers_100") && profile.answered >= 100) earned.add("answers_100");
  if (need("answers_500") && profile.answered >= 500) earned.add("answers_500");
  if (need("streak_7") && profile.bestStreak >= 7) earned.add("streak_7");
  if (need("streak_30") && profile.bestStreak >= 30) earned.add("streak_30");
  if (need("level_5") && levelFor(profile.xp, cfg.levels).level >= 5) earned.add("level_5");

  if (need("perfect_run")) {
    const perfect = await prisma.academyAttempt.findFirst({
      where: { userId, status: "done", correct: { gte: 10 }, NOT: { mode: "module" } },
      select: { correct: true, questionIds: true },
      orderBy: { correct: "desc" },
    });
    if (perfect && perfect.correct === perfect.questionIds.length) earned.add("perfect_run");
  }

  const categoryCodes = Object.entries(CATEGORY_ACHIEVEMENTS).filter(([, code]) => need(code));
  if (categoryCodes.length) {
    const cats = await prisma.academyCategory.findMany({
      where: { slug: { in: categoryCodes.map(([slug]) => slug) } },
      select: { slug: true, modules: { where: { published: true }, select: { id: true } } },
    });
    const done = new Set(
      (await prisma.academyProgress.findMany({ where: { userId }, select: { moduleId: true } })).map((p) => p.moduleId)
    );
    for (const c of cats) {
      if (c.modules.length && c.modules.every((m) => done.has(m.id))) earned.add(CATEGORY_ACHIEVEMENTS[c.slug]);
    }
  }

  if (need("live_champion")) {
    const won = await prisma.academyLiveParticipant.findFirst({ where: { userId, rank: 1 }, select: { liveId: true } });
    if (won) earned.add("live_champion");
  }
  if (need("certified")) {
    const cert = await prisma.academyCertificate.findFirst({ where: { userId, status: "issued" }, select: { id: true } });
    if (cert) earned.add("certified");
  }
  if (need("top_10") && profile.xp > 0) {
    // Only meaningful once there is a field to beat: on a board of five, everyone is "top 10".
    const [ahead, field] = await Promise.all([
      prisma.academyProfile.count({ where: { xp: { gt: profile.xp } } }),
      prisma.academyProfile.count({ where: { xp: { gt: 0 } } }),
    ]);
    if (ahead < 10 && field >= TOP10_MIN_FIELD) earned.add("top_10");
  }

  const out: Unlocked[] = [];
  for (const def of todo) {
    if (!earned.has(def.code)) continue;
    const paid = await prisma.$transaction(async (tx) => {
      const { count } = await tx.academyAchievement.createMany({ data: [{ userId, code: def.code }], skipDuplicates: true });
      if (!count) return null;
      await grant(tx, { userId, amount: def.xp, reason: "achievement", key: `ach:${userId}:${def.code}`, label: def.title });
      return def;
    });
    if (paid) out.push({ code: paid.code, title: paid.title, xp: paid.xp });
  }
  return out;
}

/**
 * Tell open leaderboards and the activity strip that something changed. A
 * content-free ping: receivers refetch from the cached public endpoints.
 */
export async function pingBoards(kind: "xp" | "achievement" | "certificate" = "xp") {
  await broadcastEvent(CH_ACADEMY, "academy", { kind, at: Date.now() });
}
