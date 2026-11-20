// Pure Academy rules: levels, scoring, periods, shuffles and the live-quiz
// clock. No I/O, no Date.now() inside - every function takes `now` - so the
// whole rulebook is unit-tested (src/lib/__tests__/academy-engine.test.ts) and
// the client can import the same functions to DISPLAY what the server decides.

import type { Difficulty, LevelDef, QuizMode, XpConfig } from "./config";

// ------------------------------------------------------------------ levels

export type LevelInfo = {
  level: number; // 1-based
  name: string;
  xp: number;
  floor: number; // XP where this level starts
  next: number | null; // XP where the next level starts (null at max)
  progress: number; // 0..1 inside this level (1 at max)
  toNext: number; // XP still needed (0 at max)
};

export function levelFor(xp: number, levels: LevelDef[]): LevelInfo {
  const sorted = [...levels].sort((a, b) => a.xp - b.xp);
  let i = 0;
  for (let k = 0; k < sorted.length; k++) if (xp >= sorted[k].xp) i = k;
  const floor = sorted[i]?.xp ?? 0;
  const next = sorted[i + 1]?.xp ?? null;
  return {
    level: i + 1,
    name: sorted[i]?.name ?? "Learner",
    xp,
    floor,
    next,
    progress: next == null ? 1 : Math.max(0, Math.min(1, (xp - floor) / (next - floor))),
    toNext: next == null ? 0 : Math.max(0, next - xp),
  };
}

// ------------------------------------------------------------------ scoring

export type AnswerScore = { points: number; speed: number; streakMult: number };

/**
 * Points for one answer. Wrong or late answers score 0 - never negative, never
 * positive. `run` is the number of consecutive correct answers INCLUDING this
 * one.
 */
export function scoreAnswer(opts: {
  correct: boolean;
  difficulty: Difficulty;
  ms: number;
  limitMs: number;
  run: number;
  cfg: XpConfig;
}): AnswerScore {
  const { correct, difficulty, ms, limitMs, run, cfg } = opts;
  if (!correct || ms > limitMs) return { points: 0, speed: 0, streakMult: 0 };
  const base = cfg.base[difficulty] ?? cfg.base.medium;
  const speed = Math.max(0, Math.min(1, 1 - ms / limitMs));
  const extraRun = Math.max(0, run - cfg.streakFrom + 1);
  const streakMult = run >= cfg.streakFrom ? Math.min(cfg.streakCap, extraRun * cfg.streakStep) : 0;
  const points = Math.round(base * (1 + cfg.speedBonus * speed) * (1 + streakMult));
  return { points, speed, streakMult };
}

/** XP for a finished quiz. 0 when nothing was answered correctly. */
export function quizXp(opts: { score: number; correct: number; total: number; mode: QuizMode; cfg: XpConfig }): number {
  const { score, correct, total, mode, cfg } = opts;
  if (correct <= 0 || score <= 0) return 0;
  let xp = score / cfg.scoreToXp;
  if (correct === total && total >= 5) xp *= 1 + cfg.perfectBonus;
  xp += cfg.modeBonus[mode] ?? 0;
  return Math.max(0, Math.round(xp));
}

/** Clamp an amount against what is left of a daily cap (0 = uncapped). */
export function applyCap(amount: number, earnedToday: number, cap: number): number {
  if (cap <= 0) return Math.max(0, amount);
  return Math.max(0, Math.min(amount, cap - earnedToday));
}

/** New learning streak after finishing something on `today`. */
export function nextStreak(lastDay: string | null | undefined, streak: number, today: string): { streak: number; continued: boolean } {
  if (lastDay === today) return { streak: Math.max(1, streak), continued: false };
  if (lastDay && dayDiff(lastDay, today) === 1) return { streak: streak + 1, continued: true };
  return { streak: 1, continued: false };
}

/** A streak shown to the member is only alive if they learned today or yesterday. */
export function liveStreak(lastDay: string | null | undefined, streak: number, today: string): number {
  if (!lastDay) return 0;
  const d = dayDiff(lastDay, today);
  return d === 0 || d === 1 ? streak : 0;
}

// ------------------------------------------------------------------ periods (UTC)

export type Period = "daily" | "weekly" | "monthly" | "alltime";
export const PERIODS: Period[] = ["daily", "weekly", "monthly", "alltime"];

export const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** ISO-8601 week key, e.g. "2026-W47". Weeks start Monday 00:00 UTC. */
export function weekKey(t: number): string {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7; // Mon=0
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const year = thursday.getUTCFullYear();
  const jan4 = Date.UTC(year, 0, 4);
  const jan4Day = (new Date(jan4).getUTCDay() + 6) % 7;
  const week1Monday = jan4 - jan4Day * 86_400_000;
  const week = Math.floor((thursday.getTime() - 3 * 86_400_000 - week1Monday) / (7 * 86_400_000)) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export const monthKey = (t: number) => new Date(t).toISOString().slice(0, 7);

/** [start, end) of the period containing `t`, plus its key. alltime is [0, +inf). */
export function periodBounds(period: Period, t: number): { key: string; start: number; end: number } {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const dd = d.getUTCDate();
  if (period === "daily") {
    const start = Date.UTC(y, m, dd);
    return { key: dayKey(start), start, end: start + 86_400_000 };
  }
  if (period === "weekly") {
    const dow = (d.getUTCDay() + 6) % 7;
    const start = Date.UTC(y, m, dd - dow);
    return { key: weekKey(start), start, end: start + 7 * 86_400_000 };
  }
  if (period === "monthly") {
    const start = Date.UTC(y, m, 1);
    return { key: monthKey(start), start, end: Date.UTC(y, m + 1, 1) };
  }
  return { key: "alltime", start: 0, end: 8.64e15 };
}

/** The period that ended most recently before `t`. */
export function previousPeriod(period: Exclude<Period, "alltime">, t: number) {
  const cur = periodBounds(period, t);
  return periodBounds(period, cur.start - 1);
}

// ------------------------------------------------------------------ randomness

/** Small seeded PRNG (mulberry32) so a daily challenge is the same set for everyone. */
export function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A permutation of [0..n): shown position -> original option index. */
export const permutation = (n: number, rand: () => number = Math.random) => shuffle([...Array(n).keys()], rand);

// ------------------------------------------------------------------ live quiz clock

export type LiveClockInput = {
  status: string; // scheduled | live | ended | cancelled
  scheduledAt: number;
  startedAt: number | null;
  pausedAt: number | null;
  pausedMs: number;
  questionSec: number;
  revealSec: number;
  count: number;
};

export type LivePhase =
  | { kind: "scheduled"; startsAt: number }
  | { kind: "countdown"; startsAt: number }
  | { kind: "question"; index: number; opensAt: number; closesAt: number; paused: boolean }
  | { kind: "reveal"; index: number; closesAt: number; nextAt: number; paused: boolean }
  | { kind: "ended" }
  | { kind: "cancelled" };

/**
 * Where a live quiz is at `now`. The whole schedule is derived from startedAt,
 * the total paused time and two durations, so every participant and the server
 * compute the same answer with no process ticking anywhere. While paused the
 * clock is frozen at pausedAt and all deadlines are reported as if resumed now.
 */
export function livePhase(q: LiveClockInput, now: number): LivePhase {
  if (q.status === "cancelled") return { kind: "cancelled" };
  if (q.status === "ended") return { kind: "ended" };
  const start = q.startedAt ?? (now >= q.scheduledAt ? q.scheduledAt : null);
  if (start == null) return { kind: "scheduled", startsAt: q.scheduledAt };
  if (now < start) return { kind: "countdown", startsAt: start };
  const paused = q.pausedAt != null;
  const clock = paused ? (q.pausedAt as number) : now;
  const shift = paused ? now - (q.pausedAt as number) : 0; // deadlines move while paused
  const elapsed = clock - start - q.pausedMs;
  const qMs = q.questionSec * 1000;
  const slot = qMs + q.revealSec * 1000;
  const index = Math.floor(elapsed / slot);
  if (index >= q.count) return { kind: "ended" };
  const slotStart = start + q.pausedMs + index * slot + shift;
  const closesAt = slotStart + qMs;
  if (elapsed - index * slot < qMs) return { kind: "question", index, opensAt: slotStart, closesAt, paused };
  return { kind: "reveal", index, closesAt, nextAt: slotStart + slot, paused };
}

/** Live score for one answer: difficulty base plus up to `speedBonus` for speed. */
export function liveAnswerPoints(correct: boolean, difficulty: Difficulty, ms: number, limitMs: number, cfg: XpConfig): number {
  if (!correct || ms > limitMs) return 0;
  const base = cfg.base[difficulty] ?? cfg.base.medium;
  return Math.round(base * (1 + cfg.speedBonus * Math.max(0, 1 - ms / limitMs)));
}

export type Ranked = { userId: string; score: number; correct: number; totalMs: number; joinedAt: number };

/** Tie-break: higher score, then more correct, then less total answer time, then who joined first. */
export function rankLive<T extends Ranked>(rows: T[]): (T & { rank: number })[] {
  return [...rows]
    .sort((a, b) => b.score - a.score || b.correct - a.correct || a.totalMs - b.totalMs || a.joinedAt - b.joinedAt || (a.userId < b.userId ? -1 : 1))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

// ------------------------------------------------------------------ certificates

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I

/** Public certificate code: XYZ-XXXX-XXXX from 40 random bits. */
export function certificateCode(randomBytes: Uint8Array): string {
  const chars: string[] = [];
  for (let i = 0; i < 8; i++) chars.push(CODE_ALPHABET[randomBytes[i % randomBytes.length] % CODE_ALPHABET.length]);
  return `XYZ-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

export const CERT_CODE_RE = /^XYZ-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;

export function certificateTitle(kind: string): string {
  switch (kind) {
    case "daily":
      return "Daily Quiz Champion";
    case "weekly":
      return "Weekly Quiz Champion";
    case "monthly":
      return "Monthly Web3 Champion";
    case "live":
      return "Live Quiz Winner";
    case "milestone":
      return "Academy Milestone";
    default:
      return "Special Event Champion";
  }
}

export const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};
