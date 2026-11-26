import "server-only";
import { prisma } from "@/lib/prisma";
import { publicImageUrl } from "@/lib/utils";

// "Challenge friends": a finished attempt is a challenge; everyone who replays
// it (AcademyAttempt.challengeOf = its id) lands on its board. Public data
// only: display name, avatar, score, correct, time. Never an email.

type Row = { id: string; score: number; correct: number; timeMs: number; finishedAt: Date | null; userId: string; user: { name: string | null; username: string | null; image: string | null } };
const SELECT = { id: true, score: true, correct: true, timeMs: true, finishedAt: true, userId: true, user: { select: { name: true, username: true, image: true } } } as const;

const display = (u: Row["user"]) => (u.username ? `@${u.username}` : u.name?.trim() || "A learner");

/** Higher score first; on a tie, the faster run. */
export const byScore = (a: { score: number; timeMs: number }, b: { score: number; timeMs: number }) => b.score - a.score || a.timeMs - b.timeMs;

/** One entry per person (their best replay), host excluded. */
export function bestPerPerson<T extends { userId: string; score: number; timeMs: number }>(rows: T[], hostId: string): T[] {
  const best = new Map<string, T>();
  for (const r of rows) {
    if (r.userId === hostId) continue;
    const cur = best.get(r.userId);
    if (!cur || byScore(r, cur) < 0) best.set(r.userId, r);
  }
  return [...best.values()].sort(byScore);
}

export type BoardEntry = { userId: string; name: string; image: string | null; score: number; correct: number; timeMs: number; host: boolean; rank: number };

export async function challengeBoard(id: string, limit = 10) {
  const host = await prisma.academyAttempt.findUnique({ where: { id }, select: { ...SELECT, status: true, questionIds: true, mode: true } });
  if (!host || host.status !== "done") return null;
  const replays = await prisma.academyAttempt.findMany({ where: { challengeOf: id, status: "done" }, select: SELECT, orderBy: [{ score: "desc" }, { timeMs: "asc" }], take: 300 });
  const takers = bestPerPerson(replays, host.userId);
  const all = [{ ...host, host: true }, ...takers.map((t) => ({ ...t, host: false }))].sort(byScore);
  const entries: BoardEntry[] = all.map((r, i) => ({
    userId: r.userId,
    name: display(r.user),
    image: publicImageUrl(r.user.image, r.userId),
    score: r.score,
    correct: r.correct,
    timeMs: r.timeMs,
    host: r.host,
    rank: i + 1,
  }));
  return {
    id,
    host: display(host.user),
    total: host.questionIds.length,
    takers: takers.length,
    beaten: takers.filter((t) => byScore(t, host) < 0).length, // takers who beat the host
    board: entries.slice(0, limit),
  };
}

/**
 * The challenges this member has set that friends have played: newest first,
 * with how many played and how many beat them. For the dashboard.
 */
export async function myChallenges(userId: string, max = 3) {
  const mine = await prisma.academyAttempt.findMany({
    where: { userId, status: "done", mode: { notIn: ["daily", "weekly"] } },
    select: { id: true, score: true, timeMs: true, mode: true, finishedAt: true, questionIds: true },
    orderBy: { finishedAt: "desc" },
    take: 40,
  });
  if (!mine.length) return [];
  const replays = await prisma.academyAttempt.findMany({
    where: { challengeOf: { in: mine.map((m) => m.id) }, status: "done" },
    select: { challengeOf: true, userId: true, score: true, timeMs: true },
    take: 1000,
  });
  const out: { id: string; mode: string; score: number; total: number; takers: number; beaten: number; at: string | null }[] = [];
  for (const m of mine) {
    const takers = bestPerPerson(replays.filter((r) => r.challengeOf === m.id), userId);
    if (!takers.length) continue;
    out.push({ id: m.id, mode: m.mode, score: m.score, total: m.questionIds.length, takers: takers.length, beaten: takers.filter((t) => byScore(t, m) < 0).length, at: m.finishedAt?.toISOString() ?? null });
    if (out.length >= max) break;
  }
  return out;
}
