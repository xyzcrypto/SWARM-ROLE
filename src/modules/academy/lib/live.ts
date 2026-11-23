import "server-only";
import { prisma } from "@/lib/prisma";
import { publicImageUrl } from "@/lib/utils";
import { broadcastEvent } from "@/lib/realtime";
import { liveChannel } from "@/lib/realtime-channels";
import type { Difficulty } from "./config";
import { loadConfig, ensureSeeded } from "./store";
import { liveAnswerPoints, livePhase, rankLive, shuffle, type LivePhase } from "./engine";
import { checkAchievements, grant, pingBoards } from "./xp";
import { issueCertificate } from "./board";
import { clip, hinglish } from "./voice";
import { GRACE_MS, QuizError } from "./quiz";

const COUNTDOWN_MS = 6_000;

type LiveRow = NonNullable<Awaited<ReturnType<typeof prisma.academyLive.findUnique>>>;

const clockOf = (l: LiveRow) => ({
  status: l.status,
  scheduledAt: l.scheduledAt.getTime(),
  startedAt: l.startedAt?.getTime() ?? null,
  pausedAt: l.pausedAt?.getTime() ?? null,
  pausedMs: l.pausedMs,
  questionSec: l.questionSec,
  revealSec: l.revealSec,
  count: l.questionIds.length,
});

const name = (u: { name: string | null; username: string | null }) => u.name?.trim() || (u.username ? `@${u.username}` : "XYZ Learner");

async function notify(id: string, kind: string) {
  await broadcastEvent(liveChannel(id), "live", { kind, at: Date.now() });
}

export async function createLive(input: {
  title: string;
  description?: string;
  scheduledAt: number;
  count: number;
  category?: string | null;
  difficulty?: Difficulty | "mixed";
  questionSec: number;
  revealSec: number;
  createdById: string;
}) {
  await ensureSeeded();
  const cat = input.category ? await prisma.academyCategory.findUnique({ where: { slug: input.category }, select: { id: true } }) : null;
  const rows = await prisma.academyQuestion.findMany({
    where: { active: true, ...(cat ? { categoryId: cat.id } : {}), ...(input.difficulty && input.difficulty !== "mixed" ? { difficulty: input.difficulty } : {}) },
    select: { id: true },
  });
  if (rows.length < input.count) throw new QuizError(`Only ${rows.length} questions match. Lower the count or widen the filter.`, 400);
  return prisma.academyLive.create({
    data: {
      title: input.title,
      description: input.description ?? "",
      scheduledAt: new Date(input.scheduledAt),
      questionIds: shuffle(rows.map((r) => r.id)).slice(0, input.count),
      questionSec: input.questionSec,
      revealSec: input.revealSec,
      createdById: input.createdById,
    },
  });
}

export async function listLive(now = Date.now()) {
  const rows = await prisma.academyLive.findMany({
    where: { OR: [{ status: { in: ["scheduled", "live"] } }, { status: "ended", endedAt: { gte: new Date(now - 30 * 86_400_000) } }] },
    orderBy: { scheduledAt: "asc" },
    take: 40,
    include: { _count: { select: { participants: true } } },
  });
  const winners = await prisma.academyLiveParticipant.findMany({
    where: { liveId: { in: rows.filter((r) => r.status === "ended").map((r) => r.id) }, rank: 1 },
    select: { liveId: true, score: true, user: { select: { id: true, name: true, username: true, image: true } } },
  });
  const w = new Map(winners.map((x) => [x.liveId, { name: name(x.user), image: publicImageUrl(x.user.image, x.user.id), score: x.score }]));
  return rows.map((l) => {
    const phase = livePhase(clockOf(l), now);
    const state = phase.kind === "ended" ? "ended" : phase.kind === "scheduled" ? "upcoming" : phase.kind === "cancelled" ? "cancelled" : "live";
    return {
      id: l.id,
      title: l.title,
      description: l.description,
      scheduledAt: l.scheduledAt.toISOString(),
      questions: l.questionIds.length,
      questionSec: l.questionSec,
      participants: l._count.participants,
      state,
      winner: w.get(l.id) ?? null,
    };
  });
}

/**
 * Close a quiz whose clock has run out (or that a host ended): rank everyone
 * with the tie-break rules, pay XP and issue the winners' certificates.
 * The `finalizedAt: null` guard makes this run once however many requests
 * notice the end at the same moment.
 */
export async function finalizeLive(id: string) {
  const { count } = await prisma.academyLive.updateMany({
    where: { id, finalizedAt: null },
    data: { status: "ended", finalizedAt: new Date(), endedAt: new Date() },
  });
  if (!count) return false;
  const cfg = await loadConfig();
  const parts = await prisma.academyLiveParticipant.findMany({ where: { liveId: id } });
  const ranked = rankLive(parts.map((p) => ({ ...p, joinedAt: p.joinedAt.getTime() })));
  for (const r of ranked) {
    await prisma.academyLiveParticipant.update({ where: { liveId_userId: { liveId: id, userId: r.userId } }, data: { rank: r.rank } });
    const xp = Math.round(r.score * cfg.xp.livePerPoint) + (r.score > 0 ? cfg.xp.livePodium[r.rank - 1] ?? 0 : 0);
    if (xp > 0) {
      await prisma.$transaction(async (tx) => {
        await grant(tx, { userId: r.userId, amount: xp, reason: "live", key: `live:${id}:${r.userId}`, label: `Live quiz, ${r.rank}${r.rank === 1 ? "st" : r.rank === 2 ? "nd" : r.rank === 3 ? "rd" : "th"} place` });
      });
    }
  }
  const rule = cfg.awards.live;
  for (const r of ranked.slice(0, rule.top)) {
    if (r.score <= 0 || r.score < rule.minXp) continue;
    await issueCertificate({ userId: r.userId, kind: "live", periodKey: `live:${id}`, rank: r.rank, score: r.score, status: rule.auto ? "issued" : "pending" });
  }
  for (const r of ranked.slice(0, 10)) await checkAchievements(r.userId, cfg).catch(() => []);
  await notify(id, "ended");
  await pingBoards("xp");
  return true;
}

async function loadLive(id: string, now: number): Promise<{ live: LiveRow; phase: LivePhase }> {
  let live = await prisma.academyLive.findUnique({ where: { id } });
  if (!live) throw new QuizError("Live quiz not found.", 404);
  let phase = livePhase(clockOf(live), now);
  // Persist the scheduled auto-start so the host panel and lists agree.
  if (live.status === "scheduled" && phase.kind !== "scheduled") {
    await prisma.academyLive.updateMany({ where: { id, status: "scheduled" }, data: { status: "live", startedAt: live.scheduledAt } });
    live = { ...live, status: "live", startedAt: live.scheduledAt };
  }
  if (phase.kind === "ended" && !live.finalizedAt) {
    await finalizeLive(id);
    live = (await prisma.academyLive.findUnique({ where: { id } }))!;
    phase = livePhase(clockOf(live), now);
  }
  return { live, phase };
}

/** Everything every participant sees. Never contains an answer while a question is open. */
export async function publicLiveState(id: string, now = Date.now()) {
  const { live, phase } = await loadLive(id, now);
  const showIndex = phase.kind === "question" || phase.kind === "reveal" ? phase.index : null;
  const revealing = phase.kind === "reveal";
  const [q, participants, count, board, dist] = await Promise.all([
    showIndex != null
      ? prisma.academyQuestion.findUnique({
          where: { id: live.questionIds[showIndex] },
          select: { prompt: true, options: true, difficulty: true, answer: true, explanation: true, category: { select: { title: true } } },
        })
      : null,
    prisma.academyLiveParticipant.findMany({
      where: { liveId: id },
      orderBy: { joinedAt: "desc" },
      take: 24,
      select: { user: { select: { id: true, name: true, username: true, image: true } } },
    }),
    prisma.academyLiveParticipant.count({ where: { liveId: id } }),
    prisma.academyLiveParticipant.findMany({
      where: { liveId: id, OR: [{ score: { gt: 0 } }, { rank: { not: null } }] },
      orderBy: [{ score: "desc" }, { correct: "desc" }, { totalMs: "asc" }, { joinedAt: "asc" }],
      take: 10,
      select: { score: true, correct: true, rank: true, user: { select: { id: true, name: true, username: true, image: true } } },
    }),
    revealing && showIndex != null
      ? prisma.academyLiveAnswer.groupBy({ by: ["choice"], where: { liveId: id, index: showIndex }, _count: { _all: true } })
      : Promise.resolve([]),
  ]);
  // While a question is open, scores are shown as they stood before it: a
  // jump in someone's score would otherwise give away that a fast answer was
  // right.
  const pending = new Map<string, number>();
  if (phase.kind === "question") {
    const rows = await prisma.academyLiveAnswer.findMany({ where: { liveId: id, index: phase.index, points: { gt: 0 } }, select: { userId: true, points: true } });
    for (const r of rows) pending.set(r.userId, r.points);
  }
  const distribution = [0, 0, 0, 0];
  for (const d of dist) if (d.choice >= 0 && d.choice < 4) distribution[d.choice] = d._count._all;
  // Reveal extras: how the room did on this question and who got it first.
  let revealStats: { answered: number; correctPct: number; fastest: { name: string; image: string | null; ms: number } | null } | null = null;
  if (revealing && showIndex != null && q) {
    const answered = distribution.reduce((a, b) => a + b, 0);
    const right = distribution[q.answer] ?? 0;
    const first = await prisma.academyLiveAnswer.findFirst({ where: { liveId: id, index: showIndex, correct: true }, orderBy: { ms: "asc" }, select: { userId: true, ms: true } });
    const who = first ? await prisma.user.findUnique({ where: { id: first.userId }, select: { id: true, name: true, username: true, image: true } }) : null;
    revealStats = {
      answered,
      correctPct: answered ? Math.round((right / answered) * 100) : 0,
      fastest: first && who ? { name: name(who), image: publicImageUrl(who.image, who.id), ms: first.ms } : null,
    };
  }
  return {
    id: live.id,
    title: live.title,
    description: live.description,
    status: live.status,
    scheduledAt: live.scheduledAt.getTime(),
    questionSec: live.questionSec,
    revealSec: live.revealSec,
    count: live.questionIds.length,
    phase,
    clock: clockOf(live),
    question:
      q && showIndex != null
        ? {
            index: showIndex,
            prompt: q.prompt,
            options: q.options as string[],
            difficulty: q.difficulty,
            category: q.category.title,
            voice: { prompt: clip(q.prompt), options: (q.options as string[]).map((o) => clip(o)) },
            hi: { prompt: hinglish(q.prompt), options: (q.options as string[]).map((o) => hinglish(o)), explanation: revealing ? hinglish(q.explanation) : null },
            ...(revealing ? { answer: q.answer, explanation: q.explanation, distribution, voiceExplanation: clip(q.explanation), stats: revealStats } : {}),
          }
        : null,
    participants: count,
    faces: participants.map((p) => ({ id: p.user.id, name: name(p.user), image: publicImageUrl(p.user.image, p.user.id) })),
    leaderboard: board
      .map((b) => ({
        rank: b.rank,
        userId: b.user.id,
        name: name(b.user),
        image: publicImageUrl(b.user.image, b.user.id),
        score: b.score - (pending.get(b.user.id) ?? 0),
        correct: b.correct - (pending.has(b.user.id) ? 1 : 0),
      }))
      .filter((b) => b.score > 0 || b.rank != null)
      .sort((x, y) => (x.rank ?? 0) - (y.rank ?? 0) || y.score - x.score || y.correct - x.correct)
      .map((b, i) => ({ ...b, rank: b.rank ?? i + 1 })),
  };
}

/** The caller's own seat: joined?, their answers, score and rank, and the server clock. */
export async function myLiveState(id: string, userId: string, now = Date.now()) {
  const live = await prisma.academyLive.findUnique({ where: { id } });
  if (!live) throw new QuizError("Live quiz not found.", 404);
  const phase = livePhase(clockOf(live), now);
  const openIndex = phase.kind === "question" ? phase.index : -1;
  const me = await prisma.academyLiveParticipant.findUnique({ where: { liveId_userId: { liveId: id, userId } } });
  const answers = me ? await prisma.academyLiveAnswer.findMany({ where: { liveId: id, userId }, select: { index: true, choice: true, correct: true, points: true, ms: true } }) : [];
  // While a question is open only the fact that you answered is returned;
  // correctness and its points arrive with the reveal, for everyone at once.
  const hidden = answers.find((a) => a.index === openIndex);
  const score = (me?.score ?? 0) - (hidden?.points ?? 0);
  let rank: number | null = me?.rank ?? null;
  if (me && rank == null && score > 0) {
    // Others only: my own stored score still includes the points of an answer
    // that is not revealed yet, so counting myself put me behind myself
    // (two players, and I was "#3" while a question was open).
    rank = (await prisma.academyLiveParticipant.count({ where: { liveId: id, userId: { not: userId }, score: { gt: score } } })) + 1;
  }
  return {
    serverNow: now,
    userId,
    joined: !!me,
    score,
    correct: (me?.correct ?? 0) - (hidden?.correct ? 1 : 0),
    rank,
    answers: answers.map((a) =>
      a.index === openIndex
        ? { index: a.index, choice: a.choice, correct: null, points: null, ms: null }
        : { index: a.index, choice: a.choice, correct: a.correct, points: a.points, ms: a.ms }
    ),
  };
}

export async function joinLive(id: string, userId: string) {
  const { live, phase } = await loadLive(id, Date.now());
  if (phase.kind === "ended" || phase.kind === "cancelled") throw new QuizError("This live quiz has finished.", 409);
  const { count } = await prisma.academyLiveParticipant.createMany({ data: [{ liveId: live.id, userId }], skipDuplicates: true });
  if (count) await notify(id, "join");
  return { joined: true };
}

export async function answerLive(id: string, userId: string, index: number, choice: number) {
  const now = Date.now();
  const live = await prisma.academyLive.findUnique({ where: { id } });
  if (!live) throw new QuizError("Live quiz not found.", 404);
  const seat = await prisma.academyLiveParticipant.findUnique({ where: { liveId_userId: { liveId: id, userId } } });
  if (!seat) throw new QuizError("Join the quiz first.", 403);
  // Accept the answer if the question was open now, or within the network grace before now.
  const phaseNow = livePhase(clockOf(live), now);
  const phaseGrace = livePhase(clockOf(live), now - GRACE_MS);
  const open = (p: LivePhase) => p.kind === "question" && p.index === index && !p.paused;
  const phase = open(phaseNow) ? phaseNow : open(phaseGrace) ? phaseGrace : null;
  if (!phase || phase.kind !== "question") throw new QuizError("Time is up for that question.", 409);
  const q = await prisma.academyQuestion.findUnique({ where: { id: live.questionIds[index] }, select: { answer: true, difficulty: true } });
  if (!q) throw new QuizError("Question missing.", 410);
  const cfg = await loadConfig();
  const limit = live.questionSec * 1000;
  const ms = Math.max(0, Math.min(limit, now - phase.opensAt));
  const pick = choice >= 0 && choice < 4 ? choice : -1;
  const correct = pick === q.answer;
  const points = liveAnswerPoints(correct, q.difficulty as Difficulty, ms, limit, cfg.xp);
  try {
    await prisma.$transaction([
      prisma.academyLiveAnswer.create({ data: { liveId: id, userId, index, choice: pick, correct, ms, points } }),
      prisma.academyLiveParticipant.update({
        where: { liveId_userId: { liveId: id, userId } },
        data: { score: { increment: points }, correct: { increment: correct ? 1 : 0 }, totalMs: { increment: ms } },
      }),
    ]);
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") throw new QuizError("You already answered this question.", 409);
    throw err;
  }
  // Correctness is NOT returned here: it is revealed to everyone at once.
  return { accepted: true, index, ms };
}

/**
 * The full answer review of a FINISHED live quiz: every question with its
 * correct answer, the room's vote split, how many got it right, who answered
 * correctly first, and the explanation; plus the final standings. Nothing here
 * is secret any more once the quiz has ended, and it never changes again, so
 * the route caches it at the edge.
 */
export async function liveResults(id: string) {
  const { live, phase } = await loadLive(id, Date.now());
  if (phase.kind !== "ended" || live.status !== "ended") throw new QuizError("Results open when the quiz ends.", 409);
  const [qs, split, firsts, parts, perUser] = await Promise.all([
    prisma.academyQuestion.findMany({
      where: { id: { in: live.questionIds } },
      select: { id: true, prompt: true, options: true, answer: true, explanation: true, difficulty: true, category: { select: { title: true } } },
    }),
    prisma.academyLiveAnswer.groupBy({ by: ["index", "choice"], where: { liveId: id }, _count: { _all: true }, _avg: { ms: true } }),
    prisma.academyLiveAnswer.findMany({ where: { liveId: id, correct: true }, orderBy: [{ index: "asc" }, { ms: "asc" }], distinct: ["index"], select: { index: true, userId: true, ms: true } }),
    prisma.academyLiveParticipant.findMany({
      where: { liveId: id },
      orderBy: [{ rank: "asc" }, { score: "desc" }],
      take: 100,
      select: { rank: true, score: true, correct: true, totalMs: true, user: { select: { id: true, name: true, username: true, image: true } } },
    }),
    prisma.academyLiveAnswer.groupBy({ by: ["userId"], where: { liveId: id, choice: { gte: 0 } }, _count: { _all: true }, _avg: { ms: true } }),
  ]);
  const pu = new Map(perUser.map((r) => [r.userId, { answered: r._count._all, avgMs: r._avg.ms == null ? null : Math.round(r._avg.ms) }]));
  const byId = new Map(qs.map((q) => [q.id, q]));
  const fastIds = [...new Set(firsts.map((f) => f.userId))];
  const fastUsers = fastIds.length ? await prisma.user.findMany({ where: { id: { in: fastIds } }, select: { id: true, name: true, username: true, image: true } }) : [];
  const fu = new Map(fastUsers.map((u) => [u.id, u]));
  const questions = live.questionIds.map((qid, index) => {
    const q = byId.get(qid);
    const distribution = [0, 0, 0, 0];
    let answered = 0;
    let avgMsSum = 0;
    for (const r of split) {
      if (r.index !== index) continue;
      answered += r._count._all;
      avgMsSum += (r._avg.ms ?? 0) * r._count._all;
      if (r.choice >= 0 && r.choice < 4) distribution[r.choice] = r._count._all;
    }
    const f = firsts.find((x) => x.index === index);
    const fuser = f ? fu.get(f.userId) : null;
    const right = q ? distribution[q.answer] ?? 0 : 0;
    return q
      ? {
          index,
          prompt: q.prompt,
          options: q.options as string[],
          answer: q.answer,
          explanation: q.explanation,
          difficulty: q.difficulty,
          category: q.category.title,
          hi: { prompt: hinglish(q.prompt), options: (q.options as string[]).map((o) => hinglish(o)), explanation: hinglish(q.explanation) },
          distribution,
          answered,
          correctPct: answered ? Math.round((right / answered) * 100) : 0,
          avgMs: answered ? Math.round(avgMsSum / answered) : null,
          fastest: f && fuser ? { name: name(fuser), image: publicImageUrl(fuser.image, fuser.id), ms: f.ms } : null,
        }
      : null;
  });
  return {
    id: live.id,
    title: live.title,
    endedAt: live.endedAt?.toISOString() ?? null,
    questionSec: live.questionSec,
    count: live.questionIds.length,
    questions: questions.filter((x): x is NonNullable<typeof x> => x != null),
    standings: parts.map((p, i) => ({
      rank: p.rank ?? i + 1,
      userId: p.user.id,
      name: name(p.user),
      image: publicImageUrl(p.user.image, p.user.id),
      score: p.score,
      correct: p.correct,
      answered: pu.get(p.user.id)?.answered ?? 0,
      avgMs: pu.get(p.user.id)?.avgMs ?? null,
    })),
  };
}

export type HostAction = "start" | "pause" | "resume" | "end" | "cancel";

export async function hostLive(id: string, action: HostAction) {
  const now = Date.now();
  const live = await prisma.academyLive.findUnique({ where: { id } });
  if (!live) throw new QuizError("Live quiz not found.", 404);
  if (live.status === "ended" || live.status === "cancelled") throw new QuizError("This quiz is already over.", 409);
  if (action === "start") {
    if (live.startedAt && live.startedAt.getTime() <= now) throw new QuizError("Already started.", 409);
    await prisma.academyLive.update({ where: { id }, data: { status: "live", startedAt: new Date(now + COUNTDOWN_MS), pausedAt: null, pausedMs: 0 } });
  } else if (action === "pause") {
    if (live.pausedAt) throw new QuizError("Already paused.", 409);
    if (!live.startedAt && live.status !== "live") throw new QuizError("Not started yet.", 409);
    await prisma.academyLive.update({ where: { id }, data: { pausedAt: new Date(now), startedAt: live.startedAt ?? live.scheduledAt, status: "live" } });
  } else if (action === "resume") {
    if (!live.pausedAt) throw new QuizError("Not paused.", 409);
    await prisma.academyLive.update({ where: { id }, data: { pausedAt: null, pausedMs: live.pausedMs + (now - live.pausedAt.getTime()) } });
  } else if (action === "end") {
    await finalizeLive(id);
    return;
  } else if (action === "cancel") {
    await prisma.academyLive.update({ where: { id }, data: { status: "cancelled", endedAt: new Date(now), finalizedAt: new Date(now) } });
  }
  await notify(id, action);
}
