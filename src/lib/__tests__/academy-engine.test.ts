import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  applyCap,
  certificateCode,
  CERT_CODE_RE,
  levelFor,
  liveAnswerPoints,
  livePhase,
  liveStreak,
  nextStreak,
  periodBounds,
  permutation,
  previousPeriod,
  quizXp,
  rankLive,
  rng,
  scoreAnswer,
  weekKey,
} from "@modules/academy/lib/engine";
import { DEFAULT_ACHIEVEMENTS, DEFAULT_LEVELS, DEFAULT_XP, mergeAchievements, mergeConfig } from "@modules/academy/lib/config";

const cfg = DEFAULT_XP;

describe("academy levels", () => {
  it("starts at level 1 with progress toward level 2", () => {
    const l = levelFor(150, DEFAULT_LEVELS);
    expect(l.level).toBe(1);
    expect(l.name).toBe("Web3 Beginner");
    expect(l.next).toBe(300);
    expect(l.toNext).toBe(150);
    expect(l.progress).toBeCloseTo(0.5);
  });
  it("tops out at the last level", () => {
    const l = levelFor(1_000_000, DEFAULT_LEVELS);
    expect(l.level).toBe(DEFAULT_LEVELS.length);
    expect(l.next).toBeNull();
    expect(l.progress).toBe(1);
    expect(l.toNext).toBe(0);
  });
  it("crosses a boundary exactly at its XP", () => {
    expect(levelFor(299, DEFAULT_LEVELS).level).toBe(1);
    expect(levelFor(300, DEFAULT_LEVELS).level).toBe(2);
  });
});

describe("academy scoring", () => {
  it("never rewards a wrong answer", () => {
    expect(scoreAnswer({ correct: false, difficulty: "expert", ms: 100, limitMs: 30_000, run: 0, cfg }).points).toBe(0);
  });
  it("never rewards a late answer", () => {
    expect(scoreAnswer({ correct: true, difficulty: "easy", ms: 31_000, limitMs: 30_000, run: 1, cfg }).points).toBe(0);
  });
  it("pays more for harder and faster", () => {
    const slowEasy = scoreAnswer({ correct: true, difficulty: "easy", ms: 29_000, limitMs: 30_000, run: 1, cfg }).points;
    const fastEasy = scoreAnswer({ correct: true, difficulty: "easy", ms: 1_000, limitMs: 30_000, run: 1, cfg }).points;
    const fastExpert = scoreAnswer({ correct: true, difficulty: "expert", ms: 1_000, limitMs: 30_000, run: 1, cfg }).points;
    expect(fastEasy).toBeGreaterThan(slowEasy);
    expect(fastExpert).toBeGreaterThan(fastEasy);
    expect(slowEasy).toBeGreaterThanOrEqual(cfg.base.easy);
  });
  it("adds a capped streak bonus from the third correct answer in a row", () => {
    const at = (run: number) => scoreAnswer({ correct: true, difficulty: "medium", ms: 30_000, limitMs: 30_000, run, cfg });
    expect(at(2).streakMult).toBe(0);
    expect(at(3).streakMult).toBeCloseTo(0.1);
    expect(at(50).streakMult).toBe(cfg.streakCap);
  });
  it("turns a quiz into XP, with nothing for zero correct", () => {
    expect(quizXp({ score: 0, correct: 0, total: 10, mode: "quick", cfg })).toBe(0);
    const some = quizXp({ score: 1000, correct: 5, total: 10, mode: "quick", cfg });
    expect(some).toBe(1000 / cfg.scoreToXp + cfg.modeBonus.quick);
    const perfect = quizXp({ score: 1000, correct: 10, total: 10, mode: "quick", cfg });
    expect(perfect).toBeGreaterThan(some);
  });
  it("applies the daily cap", () => {
    expect(applyCap(500, 2400, 2500)).toBe(100);
    expect(applyCap(500, 3000, 2500)).toBe(0);
    expect(applyCap(500, 3000, 0)).toBe(500);
  });
});

describe("academy streaks", () => {
  it("continues on consecutive days and resets after a gap", () => {
    expect(nextStreak("2026-11-19", 4, "2026-11-20")).toEqual({ streak: 5, continued: true });
    expect(nextStreak("2026-11-20", 5, "2026-11-20")).toEqual({ streak: 5, continued: false });
    expect(nextStreak("2026-11-17", 9, "2026-11-20")).toEqual({ streak: 1, continued: false });
    expect(nextStreak(null, 0, "2026-11-20")).toEqual({ streak: 1, continued: false });
  });
  it("shows a streak only while it is alive", () => {
    expect(liveStreak("2026-11-19", 4, "2026-11-20")).toBe(4);
    expect(liveStreak("2026-11-18", 4, "2026-11-20")).toBe(0);
  });
});

describe("academy periods (UTC)", () => {
  const t = Date.UTC(2026, 10, 20, 15, 30); // Fri 20 Nov 2026
  it("bounds a day", () => {
    const b = periodBounds("daily", t);
    expect(b.key).toBe("2026-11-20");
    expect(b.end - b.start).toBe(86_400_000);
  });
  it("starts weeks on Monday with ISO week numbers", () => {
    const b = periodBounds("weekly", t);
    expect(new Date(b.start).toISOString()).toBe("2026-11-16T00:00:00.000Z");
    expect(b.key).toBe("2026-W47");
    expect(weekKey(Date.UTC(2026, 0, 1))).toBe("2026-W01"); // Thu 1 Jan 2026
    expect(weekKey(Date.UTC(2027, 0, 1))).toBe("2026-W53"); // Fri 1 Jan 2027
  });
  it("bounds a month and finds the previous one", () => {
    const b = periodBounds("monthly", t);
    expect(b.key).toBe("2026-11");
    expect(new Date(b.end).toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(previousPeriod("monthly", t).key).toBe("2026-10");
    expect(previousPeriod("daily", t).key).toBe("2026-11-19");
    expect(previousPeriod("weekly", t).key).toBe("2026-W46");
  });
});

describe("academy randomness", () => {
  it("is deterministic per seed, so a daily challenge is the same for everyone", () => {
    const a = rng("academy:daily:2026-11-20");
    const b = rng("academy:daily:2026-11-20");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(rng("x")()).not.toBe(rng("y")());
  });
  it("permutes options", () => {
    const p = permutation(4, rng("p"));
    expect([...p].sort()).toEqual([0, 1, 2, 3]);
  });
});

describe("academy live clock", () => {
  const base = { status: "live", scheduledAt: 0, startedAt: 10_000, pausedAt: null, pausedMs: 0, questionSec: 20, revealSec: 5, count: 3 };
  it("counts down before the start", () => {
    expect(livePhase(base, 5_000)).toEqual({ kind: "countdown", startsAt: 10_000 });
  });
  it("opens, reveals and moves through questions on a shared schedule", () => {
    expect(livePhase(base, 10_000)).toMatchObject({ kind: "question", index: 0, closesAt: 30_000 });
    expect(livePhase(base, 31_000)).toMatchObject({ kind: "reveal", index: 0, nextAt: 35_000 });
    expect(livePhase(base, 35_000)).toMatchObject({ kind: "question", index: 1, opensAt: 35_000 });
    expect(livePhase(base, 10_000 + 3 * 25_000)).toEqual({ kind: "ended" });
  });
  it("freezes while paused and resumes where it stopped", () => {
    const paused = { ...base, pausedAt: 15_000 };
    const p = livePhase(paused, 100_000);
    expect(p).toMatchObject({ kind: "question", index: 0, paused: true });
    // deadline reported as if resumed now: 15s were left
    expect(p.kind === "question" && p.closesAt).toBe(100_000 + 15_000);
    const resumed = { ...base, pausedMs: 85_000 };
    expect(livePhase(resumed, 100_000)).toMatchObject({ kind: "question", index: 0, closesAt: 115_000 });
  });
  it("auto-starts a scheduled quiz at its time", () => {
    const s = { ...base, status: "scheduled", startedAt: null, scheduledAt: 50_000 };
    expect(livePhase(s, 40_000)).toEqual({ kind: "scheduled", startsAt: 50_000 });
    expect(livePhase(s, 50_000)).toMatchObject({ kind: "question", index: 0 });
  });
  it("scores live answers and breaks ties fairly", () => {
    expect(liveAnswerPoints(false, "hard", 1, 20_000, cfg)).toBe(0);
    expect(liveAnswerPoints(true, "hard", 0, 20_000, cfg)).toBe(Math.round(cfg.base.hard * (1 + cfg.speedBonus)));
    const ranked = rankLive([
      { userId: "a", score: 500, correct: 3, totalMs: 9000, joinedAt: 2 },
      { userId: "b", score: 500, correct: 3, totalMs: 7000, joinedAt: 3 },
      { userId: "c", score: 500, correct: 4, totalMs: 9999, joinedAt: 1 },
      { userId: "d", score: 900, correct: 2, totalMs: 1, joinedAt: 9 },
    ]);
    expect(ranked.map((r) => r.userId)).toEqual(["d", "c", "b", "a"]);
    expect(ranked[0].rank).toBe(1);
  });
});

describe("academy certificates", () => {
  it("makes codes in the public format", () => {
    const code = certificateCode(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 250]));
    expect(code).toMatch(CERT_CODE_RE);
  });
});

describe("academy config overrides", () => {
  it("merges admin overrides over defaults without dropping keys", () => {
    const m = mergeConfig(DEFAULT_XP, { dailyQuizCap: 100, base: { easy: 1 }, bogus: 5 });
    expect(m.dailyQuizCap).toBe(100);
    expect(m.base.easy).toBe(1);
    expect(m.base.hard).toBe(DEFAULT_XP.base.hard);
    expect((m as Record<string, unknown>).bogus).toBeUndefined();
  });
  it("only lets admins retune known achievements", () => {
    const a = mergeAchievements([{ code: "first_quiz", xp: 5, enabled: false }, { code: "made_up", xp: 9999 }]);
    expect(a).toHaveLength(DEFAULT_ACHIEVEMENTS.length);
    expect(a.find((x) => x.code === "first_quiz")).toMatchObject({ xp: 5, enabled: false });
  });
});

describe("academy integrity invariants (source)", () => {
  const quiz = readFileSync("src/modules/academy/lib/quiz.ts", "utf8");
  const live = readFileSync("src/modules/academy/lib/live.ts", "utf8");
  it("the open solo question is built without its answer", () => {
    const fn = quiz.slice(quiz.indexOf("function publicQuestion"), quiz.indexOf("function reviewRow"));
    // The only use allowed: choosing which two WRONG options the 50:50 hides,
    // and only once the lifeline was spent on this question.
    const without = fn.replace("a.fiftyUsed.includes(index) ? fiftyHide(a, index, q.answer) : []", "");
    expect(without).not.toMatch(/q\.answer|answer:/);
    const hide = quiz.slice(quiz.indexOf("function fiftyHide"), quiz.indexOf("function fiftyHide") + 500);
    expect(hide).toMatch(/order\[i\] !== answer/);
  });
  it("live answers are only attached in the reveal phase", () => {
    expect(live).toMatch(/\.\.\.\(revealing \? \{ answer: q\.answer/);
  });
  it("every reward goes through the idempotent ledger", () => {
    const xp = readFileSync("src/modules/academy/lib/xp.ts", "utf8");
    expect(xp).toMatch(/skipDuplicates: true/);
    expect(quiz).not.toMatch(/academyProfile\.update\([^)]*xp: \{ increment/);
  });
});
