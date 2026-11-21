import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Difficulty, QuizMode } from "./config";
import { loadConfig, ensureSeeded } from "./store";
import {
  applyCap,
  dayKey,
  levelFor,
  nextStreak,
  periodBounds,
  permutation,
  quizXp,
  rng,
  scoreAnswer,
  shuffle,
  weekKey,
} from "./engine";
import { checkAchievements, grant, pingBoards, quizXpToday, type Unlocked } from "./xp";
import { clip, hinglish } from "./voice";

/** Network slack on every answer deadline. Timing itself is the server's clock. */
export const GRACE_MS = 1_500;

export class QuizError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

export type StartInput = {
  mode: QuizMode;
  category?: string | null;
  moduleId?: string | null;
  difficulty?: Difficulty | "mixed";
  count?: number;
  challenge?: string | null;
};

type QRow = { id: string; categoryId: string; difficulty: string; prompt: string; options: unknown; answer: number; explanation: string };

const COUNTS = [5, 10, 15, 20];

async function pickIds(input: StartInput, now: number, userId: string): Promise<{ ids: string[]; categoryId: string | null; periodKey: string | null; difficulty: string }> {
  const count = COUNTS.includes(input.count ?? 10) ? (input.count as number) : 10;
  const diff = input.difficulty && input.difficulty !== "mixed" ? input.difficulty : null;

  if (input.mode === "challenge") {
    const src = await prisma.academyAttempt.findUnique({ where: { id: String(input.challenge ?? "") }, select: { questionIds: true, status: true, categoryId: true, difficulty: true } });
    if (!src || src.status !== "done") throw new QuizError("That challenge link is not valid any more.", 404);
    return { ids: src.questionIds, categoryId: src.categoryId, periodKey: null, difficulty: src.difficulty };
  }

  if (input.mode === "mistakes") {
    // Questions whose most recent answer by this member was wrong.
    const rows = await prisma.academyAnswer.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { questionId: true, correct: true },
      take: 2000,
    });
    const latest = new Map<string, boolean>();
    for (const r of rows) if (!latest.has(r.questionId)) latest.set(r.questionId, r.correct);
    const wrong = [...latest].filter(([, ok]) => !ok).map(([id]) => id);
    const active = await prisma.academyQuestion.findMany({ where: { id: { in: wrong }, active: true }, select: { id: true } });
    if (!active.length) throw new QuizError("No mistakes to review. Every question you missed has since been answered right.", 404);
    return { ids: shuffle(active.map((r) => r.id)).slice(0, count), categoryId: null, periodKey: null, difficulty: "mixed" };
  }

  if (input.mode === "speed") {
    const rows = await prisma.academyQuestion.findMany({ where: { active: true, difficulty: { in: ["easy", "medium"] } }, select: { id: true } });
    return { ids: shuffle(rows.map((r) => r.id)).slice(0, count), categoryId: null, periodKey: null, difficulty: "speed" };
  }

  if (input.mode === "module") {
    const rows = await prisma.academyQuestion.findMany({ where: { moduleId: String(input.moduleId ?? ""), active: true }, select: { id: true } });
    if (!rows.length) throw new QuizError("This lesson has no knowledge check yet.", 404);
    const mod = await prisma.academyModule.findUnique({ where: { id: String(input.moduleId) }, select: { categoryId: true, level: true } });
    return { ids: shuffle(rows.map((r) => r.id)).slice(0, 10), categoryId: mod?.categoryId ?? null, periodKey: null, difficulty: "module" };
  }

  if (input.mode === "daily" || input.mode === "weekly") {
    const daily = input.mode === "daily";
    const key = daily ? dayKey(now) : weekKey(now);
    const all = await prisma.academyQuestion.findMany({ where: { active: true }, select: { id: true, difficulty: true }, orderBy: { id: "asc" } });
    const rand = rng(`academy:${input.mode}:${key}`);
    // Same set for everyone in the period, balanced across difficulty.
    const want: Record<string, number> = daily ? { easy: 3, medium: 4, hard: 2, expert: 1 } : { easy: 4, medium: 7, hard: 6, expert: 3 };
    const ids: string[] = [];
    for (const [d, n] of Object.entries(want)) ids.push(...shuffle(all.filter((q) => q.difficulty === d).map((q) => q.id), rand).slice(0, n));
    return { ids: shuffle(ids, rand), categoryId: null, periodKey: key, difficulty: "mixed" };
  }

  let categoryId: string | null = null;
  if (input.mode === "topic") {
    const cat = await prisma.academyCategory.findFirst({ where: { slug: String(input.category ?? ""), published: true }, select: { id: true } });
    if (!cat) throw new QuizError("Pick a topic first.", 400);
    categoryId = cat.id;
  }
  const where = {
    active: true,
    ...(categoryId ? { categoryId } : {}),
    ...(input.mode === "advanced" ? { difficulty: { in: diff === "expert" ? ["expert"] : ["hard", "expert"] } } : diff ? { difficulty: diff } : {}),
  };
  const rows = await prisma.academyQuestion.findMany({ where, select: { id: true } });
  if (rows.length < 3) throw new QuizError("Not enough questions for that combination yet. Try another difficulty.", 404);
  return {
    ids: shuffle(rows.map((r) => r.id)).slice(0, count),
    categoryId,
    periodKey: null,
    difficulty: input.mode === "advanced" ? diff ?? "hard+" : diff ?? "mixed",
  };
}

export async function startQuiz(userId: string, input: StartInput) {
  await ensureSeeded();
  const now = Date.now();
  const picked = await pickIds(input, now, userId);

  if (picked.periodKey) {
    const existing = await prisma.academyAttempt.findUnique({
      where: { userId_mode_periodKey: { userId, mode: input.mode, periodKey: picked.periodKey } },
      select: { id: true, status: true },
    });
    if (existing) return { attemptId: existing.id, resumed: existing.status === "active", done: existing.status === "done" };
  }

  // One running quiz at a time: an abandoned practice quiz is closed without XP.
  await prisma.academyAttempt.updateMany({
    where: { userId, status: "active", periodKey: null },
    data: { status: "abandoned", finishedAt: new Date(now) },
  });

  try {
    const attempt = await prisma.academyAttempt.create({
      data: {
        userId,
        mode: input.mode,
        categoryId: picked.categoryId,
        moduleId: input.mode === "module" ? String(input.moduleId) : null,
        difficulty: picked.difficulty,
        questionIds: picked.ids,
        shuffles: picked.ids.map(() => permutation(4)),
        periodKey: picked.periodKey,
        challengeOf: input.mode === "challenge" ? String(input.challenge) : null,
        servedAt: new Date(now),
      },
      select: { id: true },
    });
    return { attemptId: attempt.id, resumed: false, done: false };
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002" && picked.periodKey) {
      const again = await prisma.academyAttempt.findUnique({
        where: { userId_mode_periodKey: { userId, mode: input.mode, periodKey: picked.periodKey } },
        select: { id: true, status: true },
      });
      if (again) return { attemptId: again.id, resumed: again.status === "active", done: again.status === "done" };
    }
    throw err;
  }
}

type AttemptRow = NonNullable<Awaited<ReturnType<typeof loadAttempt>>>;

async function loadAttempt(id: string) {
  return prisma.academyAttempt.findUnique({ where: { id }, include: { answers: { orderBy: { index: "asc" } } } });
}

async function questionsFor(ids: string[]): Promise<Map<string, QRow & { category: { title: string; slug: string } }>> {
  const rows = await prisma.academyQuestion.findMany({
    where: { id: { in: ids } },
    select: { id: true, categoryId: true, difficulty: true, prompt: true, options: true, answer: true, explanation: true, category: { select: { title: true, slug: true } } },
  });
  return new Map(rows.map((r) => [r.id, r]));
}

const limitFor = (difficulty: string, cfg: Awaited<ReturnType<typeof loadConfig>>, mode?: string) =>
  (mode === "speed" ? cfg.xp.speedSeconds : (cfg.xp.seconds[difficulty as Difficulty] ?? cfg.xp.seconds.medium)) * 1000;

/** The two wrong options (shown positions) the 50:50 lifeline removes. Seeded, so a resume shows the same two. */
function fiftyHide(a: { id: string; shuffles: unknown }, index: number, answer: number): number[] {
  const order = (a.shuffles as number[][])[index] ?? [0, 1, 2, 3];
  const wrongShown = [0, 1, 2, 3].filter((i) => order[i] !== answer);
  return shuffle(wrongShown, rng(`fifty:${a.id}:${index}`)).slice(0, 2).sort();
}

/** The question as a browser may see it: options in shown order, no answer. */
function publicQuestion(a: AttemptRow, q: QRow & { category: { title: string } }, index: number, limitMs: number) {
  const order = (a.shuffles as number[][])[index] ?? [0, 1, 2, 3];
  const options = q.options as string[];
  const servedAt = a.servedAt.getTime();
  return {
    voice: { prompt: clip(q.prompt), options: order.map((o) => clip(options[o])) },
    hi: { prompt: hinglish(q.prompt), options: order.map((o) => hinglish(options[o])) },
    hidden: a.fiftyUsed.includes(index) ? fiftyHide(a, index, q.answer) : [],
    fiftyLeft: 0,
    index,
    total: a.questionIds.length,
    prompt: q.prompt,
    options: order.map((o) => options[o]),
    difficulty: q.difficulty,
    category: q.category.title,
    limitMs,
    servedAt,
    deadline: servedAt + limitMs,
  };
}

/** The full review of one answered question (safe to show after it is answered). */
function reviewRow(a: AttemptRow, q: QRow, index: number) {
  const order = (a.shuffles as number[][])[index] ?? [0, 1, 2, 3];
  const ans = a.answers.find((x) => x.index === index);
  const options = q.options as string[];
  return {
    index,
    prompt: q.prompt,
    options: order.map((o) => options[o]),
    difficulty: q.difficulty,
    chosen: ans ? (ans.choice < 0 ? -1 : order.indexOf(ans.choice)) : null,
    correctShown: order.indexOf(q.answer),
    correct: ans?.correct ?? false,
    points: ans?.points ?? 0,
    ms: ans?.ms ?? 0,
    fresh: ans?.fresh ?? true,
    assisted: ans?.assisted ?? false,
    explanation: q.explanation,
    voice: { prompt: clip(q.prompt), explanation: clip(q.explanation) },
    hi: { prompt: hinglish(q.prompt), options: order.map((o) => hinglish(options[o])), explanation: hinglish(q.explanation) },
  };
}

/** Record a timeout for the current question if its deadline has passed unanswered. */
async function settleTimeout(a: AttemptRow, now: number): Promise<boolean> {
  if (a.status !== "active" || a.revealed) return false;
  const q = await prisma.academyQuestion.findUnique({ where: { id: a.questionIds[a.current] }, select: { difficulty: true } });
  const cfg = await loadConfig();
  const limit = limitFor(q?.difficulty ?? "medium", cfg, a.mode);
  if (now <= a.servedAt.getTime() + limit + GRACE_MS) return false;
  try {
    await prisma.$transaction([
      prisma.academyAnswer.create({
        data: { attemptId: a.id, userId: a.userId, index: a.current, questionId: a.questionIds[a.current], choice: -1, correct: false, ms: limit, points: 0 },
      }),
      prisma.academyAttempt.update({ where: { id: a.id }, data: { revealed: true, run: 0, timeMs: { increment: limit } } }),
    ]);
  } catch (err) {
    if ((err as { code?: string })?.code !== "P2002") throw err;
  }
  return true;
}

export async function getQuizState(userId: string, attemptId: string) {
  let a = await loadAttempt(attemptId);
  if (!a || a.userId !== userId) throw new QuizError("Quiz not found.", 404);
  if (await settleTimeout(a, Date.now())) a = (await loadAttempt(attemptId))!;
  const cfg = await loadConfig();
  const qs = await questionsFor(a.questionIds);
  const answered = a.answers.map((x) => {
    const q = qs.get(x.questionId);
    return q ? reviewRow(a!, q, x.index) : null;
  });
  const q = qs.get(a.questionIds[a.current]);
  const base = {
    attemptId: a.id,
    mode: a.mode,
    status: a.status,
    total: a.questionIds.length,
    current: a.current,
    revealed: a.revealed,
    score: a.score,
    correct: a.correct,
    run: a.run,
    serverNow: Date.now(),
    answered: answered.filter(Boolean),
  };
  if (a.status !== "active" || !q) return { ...base, question: null };
  const pq = publicQuestion(a, q, a.current, limitFor(q.difficulty, cfg, a.mode));
  pq.fiftyLeft = Math.max(0, cfg.xp.fiftyPerQuiz - a.fiftyUsed.length);
  return { ...base, question: pq };
}

export async function answerQuiz(userId: string, attemptId: string, index: number, choice: number) {
  const now = Date.now();
  const a = await loadAttempt(attemptId);
  if (!a || a.userId !== userId) throw new QuizError("Quiz not found.", 404);
  if (a.status !== "active") throw new QuizError("This quiz is finished.", 409);
  if (index !== a.current || a.revealed) throw new QuizError("That question is already answered.", 409);
  const cfg = await loadConfig();
  const q = (await questionsFor([a.questionIds[index]])).get(a.questionIds[index]);
  if (!q) throw new QuizError("Question missing.", 410);

  const limit = limitFor(q.difficulty, cfg, a.mode);
  const ms = Math.max(0, now - a.servedAt.getTime());
  const order = (a.shuffles as number[][])[index] ?? [0, 1, 2, 3];
  const original = choice >= 0 && choice < 4 ? order[choice] : -1;
  const inTime = ms <= limit + GRACE_MS;
  const correct = inTime && original === q.answer;
  const run = correct ? a.run + 1 : 0;
  const assisted = a.fiftyUsed.includes(index);
  const raw = scoreAnswer({ correct, difficulty: q.difficulty as Difficulty, ms: Math.min(ms, limit), limitMs: limit, run, cfg: cfg.xp }).points;
  const points = assisted ? Math.round(raw * cfg.xp.fiftyKeep) : raw;

  // Re-answering a question you already got right for XP recently still scores,
  // but earns no XP: replaying the same quiz is practice, not progress.
  let fresh = true;
  if (correct && cfg.xp.repeatCooldownDays > 0) {
    const prior = await prisma.academyAnswer.findFirst({
      where: { userId, questionId: q.id, correct: true, fresh: true, createdAt: { gte: new Date(now - cfg.xp.repeatCooldownDays * 86_400_000) } },
      select: { id: true },
    });
    fresh = !prior;
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.academyAnswer.create({
        data: { attemptId: a.id, userId, index, questionId: q.id, choice: original, correct, ms: Math.min(ms, limit), points, fresh, assisted },
      });
      const { count } = await tx.academyAttempt.updateMany({
        where: { id: a.id, current: index, revealed: false, status: "active" },
        data: {
          revealed: true,
          score: { increment: points },
          xpScore: { increment: fresh ? points : 0 },
          correct: { increment: correct ? 1 : 0 },
          run,
          bestRun: Math.max(a.bestRun, run),
          timeMs: { increment: Math.min(ms, limit) },
        },
      });
      if (!count) throw new QuizError("That question is already answered.", 409);
    });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") throw new QuizError("That question is already answered.", 409);
    throw err;
  }

  return {
    index,
    correct,
    timedOut: !inTime || original < 0,
    correctShown: order.indexOf(q.answer),
    explanation: q.explanation,
    voice: { explanation: clip(q.explanation) },
    hi: { explanation: hinglish(q.explanation) },
    points,
    fresh,
    assisted,
    ms: Math.min(ms, limit),
    run,
    score: a.score + points,
    last: index === a.questionIds.length - 1,
  };
}

/** The 50:50 lifeline: remove two wrong options from the open question. That answer then keeps `fiftyKeep` of its points. */
export async function applyFifty(userId: string, attemptId: string, index: number) {
  const a = await loadAttempt(attemptId);
  if (!a || a.userId !== userId) throw new QuizError("Quiz not found.", 404);
  if (a.status !== "active" || a.current !== index || a.revealed) throw new QuizError("That question is not open.", 409);
  if (a.mode === "daily" || a.mode === "weekly" || a.mode === "challenge") throw new QuizError("Lifelines are off in this mode: everyone plays the same questions on equal terms.", 409);
  const cfg = await loadConfig();
  if (a.fiftyUsed.includes(index)) {
    const q0 = await prisma.academyQuestion.findUnique({ where: { id: a.questionIds[index] }, select: { answer: true } });
    return { hidden: fiftyHide(a, index, q0?.answer ?? 0), fiftyLeft: Math.max(0, cfg.xp.fiftyPerQuiz - a.fiftyUsed.length) };
  }
  if (a.fiftyUsed.length >= cfg.xp.fiftyPerQuiz) throw new QuizError("No 50:50 lifelines left in this quiz.", 409);
  const q = await prisma.academyQuestion.findUnique({ where: { id: a.questionIds[index] }, select: { answer: true } });
  if (!q) throw new QuizError("Question missing.", 410);
  const { count } = await prisma.academyAttempt.updateMany({
    where: { id: a.id, current: index, revealed: false, status: "active", NOT: { fiftyUsed: { has: index } } },
    data: { fiftyUsed: { push: index } },
  });
  if (!count) throw new QuizError("That question is not open.", 409);
  return { hidden: fiftyHide(a, index, q.answer), fiftyLeft: Math.max(0, cfg.xp.fiftyPerQuiz - a.fiftyUsed.length - 1) };
}

export async function nextQuestion(userId: string, attemptId: string) {
  const a = await loadAttempt(attemptId);
  if (!a || a.userId !== userId) throw new QuizError("Quiz not found.", 404);
  if (a.status !== "active") throw new QuizError("This quiz is finished.", 409);
  if (!a.revealed) {
    // Never answered and now out of time: settle it, then move on.
    if (!(await settleTimeout(a, Date.now()))) throw new QuizError("Answer this question first.", 409);
  }
  if (a.current >= a.questionIds.length - 1) throw new QuizError("That was the last question.", 409);
  const { count } = await prisma.academyAttempt.updateMany({
    where: { id: a.id, current: a.current, status: "active" },
    data: { current: a.current + 1, revealed: false, servedAt: new Date() },
  });
  if (!count) throw new QuizError("Already moved on.", 409);
  return getQuizState(userId, attemptId);
}

export type QuizResult = Awaited<ReturnType<typeof finishQuiz>>;

export async function finishQuiz(userId: string, attemptId: string) {
  let a = await loadAttempt(attemptId);
  if (!a || a.userId !== userId) throw new QuizError("Quiz not found.", 404);
  if (a.status === "active") {
    if (!a.revealed && (await settleTimeout(a, Date.now()))) a = (await loadAttempt(attemptId))!;
    const allAnswered = a.answers.length >= a.questionIds.length;
    if (!allAnswered && !(a.current === a.questionIds.length - 1 && a.revealed)) throw new QuizError("Finish the remaining questions first.", 409);
  }

  const cfg = await loadConfig();
  const now = Date.now();
  const today = dayKey(now);
  const total = a.questionIds.length;
  const before = await prisma.academyProfile.findUnique({ where: { userId } });
  const xpBefore = before?.xp ?? 0;
  const rankBefore = xpBefore > 0 ? (await prisma.academyProfile.count({ where: { xp: { gt: xpBefore } } })) + 1 : null;

  const breakdown = { quiz: 0, streak: 0, module: 0, achievements: 0 };
  let moduleCompleted = false;
  let streakNow = before?.streak ?? 0;

  if (a.status === "active") {
    const attempt = a;
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.academyAttempt.updateMany({ where: { id: attempt.id, status: "active" }, data: { status: "done", finishedAt: new Date(now) } });
      if (!count) return; // a parallel finish already paid this attempt

      const raw = quizXp({ score: attempt.xpScore, correct: attempt.correct, total, mode: attempt.mode as QuizMode, cfg: cfg.xp });
      const capped = applyCap(raw, await quizXpToday(tx, userId, periodBounds("daily", now).start), cfg.xp.dailyQuizCap);
      await tx.academyAttempt.update({ where: { id: attempt.id }, data: { xp: capped } });
      breakdown.quiz = await grant(tx, { userId, amount: capped, reason: "quiz", key: `quiz:${attempt.id}`, label: `${attempt.mode} quiz` });

      const prof = await tx.academyProfile.upsert({ where: { userId }, create: { userId }, update: {} });
      const s = nextStreak(prof.lastActiveDay, prof.streak, today);
      streakNow = s.streak;
      await tx.academyProfile.update({
        where: { userId },
        data: {
          quizzes: { increment: 1 },
          answered: { increment: total },
          correct: { increment: attempt.correct },
          streak: s.streak,
          bestStreak: Math.max(prof.bestStreak, s.streak),
          lastActiveDay: today,
        },
      });
      if (s.continued) {
        breakdown.streak += await grant(tx, { userId, amount: cfg.xp.streakDay, reason: "streak", key: `streak:${userId}:${today}`, label: `${s.streak}-day streak` });
        const milestone = cfg.xp.streakMilestones[String(s.streak)];
        if (milestone) breakdown.streak += await grant(tx, { userId, amount: milestone, reason: "streak", key: `streakm:${userId}:${s.streak}:${today}`, label: `${s.streak}-day streak milestone` });
      }

      if (attempt.mode === "module" && attempt.moduleId) {
        const pct = Math.round((attempt.correct / total) * 100);
        if (pct >= cfg.xp.modulePass) {
          const prev = await tx.academyProgress.findUnique({ where: { userId_moduleId: { userId, moduleId: attempt.moduleId } } });
          if (!prev) await tx.academyProgress.create({ data: { userId, moduleId: attempt.moduleId, score: pct } });
          else if (pct > prev.score) await tx.academyProgress.update({ where: { userId_moduleId: { userId, moduleId: attempt.moduleId } }, data: { score: pct } });
          moduleCompleted = true;
          breakdown.module = await grant(tx, { userId, amount: cfg.xp.module, reason: "module", key: `module:${userId}:${attempt.moduleId}`, label: "Lesson completed" });
        }
      }
    });
  }

  let unlocked: Unlocked[] = [];
  try {
    unlocked = await checkAchievements(userId, cfg);
    breakdown.achievements = unlocked.reduce((s, u) => s + u.xp, 0);
  } catch (err) {
    console.error("[academy] achievements", err);
  }

  const after = await prisma.academyProfile.findUnique({ where: { userId } });
  const xpAfter = after?.xp ?? 0;
  const rankAfter = xpAfter > 0 ? (await prisma.academyProfile.count({ where: { xp: { gt: xpAfter } } })) + 1 : null;
  const finalA = (await loadAttempt(attemptId))!;
  const qs = await questionsFor(finalA.questionIds);
  const review = finalA.questionIds.map((id, i) => (qs.get(id) ? reviewRow(finalA, qs.get(id)!, i) : null)).filter(Boolean);

  let challenge: { name: string; score: number; correct: number; total: number } | null = null;
  if (finalA.challengeOf) {
    const src = await prisma.academyAttempt.findUnique({
      where: { id: finalA.challengeOf },
      select: { score: true, correct: true, questionIds: true, user: { select: { name: true, username: true } } },
    });
    if (src) challenge = { name: src.user.username ? `@${src.user.username}` : src.user.name || "Your friend", score: src.score, correct: src.correct, total: src.questionIds.length };
  }

  if (breakdown.quiz + breakdown.streak + breakdown.module + breakdown.achievements > 0) await pingBoards(unlocked.length ? "achievement" : "xp");

  return {
    attemptId: finalA.id,
    mode: finalA.mode,
    score: finalA.score,
    correct: finalA.correct,
    total,
    accuracy: total ? Math.round((finalA.correct / total) * 100) : 0,
    timeMs: finalA.timeMs,
    bestRun: finalA.bestRun,
    xp: { ...breakdown, total: breakdown.quiz + breakdown.streak + breakdown.module + breakdown.achievements, attempt: finalA.xp },
    level: { before: levelFor(xpBefore, cfg.levels), after: levelFor(xpAfter, cfg.levels) },
    rank: { before: rankBefore, after: rankAfter },
    streak: streakNow,
    moduleCompleted,
    unlocked,
    review,
    challenge,
  };
}

/** Public, answer-free summary of a finished attempt, for "Challenge friends" links. */
export async function challengeSummary(attemptId: string) {
  const a = await prisma.academyAttempt.findUnique({
    where: { id: attemptId },
    select: { status: true, score: true, correct: true, mode: true, questionIds: true, difficulty: true, user: { select: { name: true, username: true, image: true } } },
  });
  if (!a || a.status !== "done") return null;
  return {
    id: attemptId,
    name: a.user.username ? `@${a.user.username}` : a.user.name || "A learner",
    score: a.score,
    correct: a.correct,
    total: a.questionIds.length,
    mode: a.mode,
    difficulty: a.difficulty,
  };
}

export const newToken = () => randomUUID();
