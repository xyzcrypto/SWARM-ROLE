import "server-only";
import { prisma } from "@/lib/prisma";
import { schedule, type ReviewSummary } from "./review";

/**
 * This learner's review queue. Two indexed reads on
 * AcademyAnswer(userId, questionId, createdAt): the questions ever missed,
 * then the history of just those. Retired (inactive) questions are dropped,
 * so the queue never offers something the quiz cannot serve.
 */
export async function reviewQueue(userId: string, now = Date.now()): Promise<ReviewSummary> {
  const missed = await prisma.academyAnswer.findMany({ where: { userId, correct: false }, select: { questionId: true }, distinct: ["questionId"], take: 1000 });
  if (!missed.length) return { due: [], upcoming: [], mastered: 0, nextAt: null };
  const ids = missed.map((m) => m.questionId);
  const [rows, live] = await Promise.all([
    prisma.academyAnswer.findMany({ where: { userId, questionId: { in: ids } }, select: { questionId: true, correct: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 5000 }),
    prisma.academyQuestion.findMany({ where: { id: { in: ids }, active: true }, select: { id: true } }),
  ]);
  const ok = new Set(live.map((q) => q.id));
  return schedule(rows.filter((r) => ok.has(r.questionId)), now);
}
