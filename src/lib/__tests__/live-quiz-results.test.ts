import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { streaks } from "@modules/academy/components/LiveArena";

const read = (p: string) => readFileSync(p, "utf8");

describe("live quiz: streaks", () => {
  it("counts consecutive right answers in question order", () => {
    expect(streaks([])).toEqual({ current: 0, best: 0 });
    expect(streaks([{ index: 0, correct: true }, { index: 1, correct: true }, { index: 2, correct: true }])).toEqual({ current: 3, best: 3 });
    expect(streaks([{ index: 2, correct: true }, { index: 0, correct: true }, { index: 1, correct: false }])).toEqual({ current: 1, best: 1 });
    expect(streaks([{ index: 0, correct: true }, { index: 1, correct: true }, { index: 2, correct: false }, { index: 3, correct: true }])).toEqual({ current: 1, best: 2 });
  });
  it("a skipped question breaks the run, and an unrevealed answer does not count", () => {
    expect(streaks([{ index: 0, correct: true }, { index: 2, correct: true }])).toEqual({ current: 1, best: 1 });
    expect(streaks([{ index: 0, correct: true }, { index: 1, correct: null }])).toEqual({ current: 1, best: 1 });
  });
});

describe("live quiz: results never leak an answer early", () => {
  const live = read("src/modules/academy/lib/live.ts");
  it("the results review refuses to open before the quiz has ended", () => {
    expect(live).toMatch(/if \(phase\.kind !== "ended" \|\| live\.status !== "ended"\) throw new QuizError\("Results open when the quiz ends\.", 409\)/);
  });
  it("reveal stats are only computed while revealing", () => {
    expect(live).toMatch(/if \(revealing && showIndex != null && q\) \{/);
    expect(live).toMatch(/\.\.\.\(revealing \? \{ answer: q\.answer, explanation: q\.explanation, distribution, voiceExplanation: clip\(q\.explanation\), stats: revealStats \} : \{\}\)/);
  });
  it("my rank while a question is open counts only OTHER players", () => {
    expect(live).toMatch(/userId: \{ not: userId \}, score: \{ gt: score \}/);
  });
  it("my answer time is hidden while the question is open", () => {
    expect(live).toMatch(/\? \{ index: a\.index, choice: a\.choice, correct: null, points: null, ms: null \}/);
  });
  it("a finished quiz's results are edge-cached (it never changes again)", () => {
    expect(read("src/app/api/academy/live/[id]/results/route.ts")).toMatch(/PUBLIC\(3600, 86_400\)/);
  });
});

describe("live quiz: the arena has results, sound and motion", () => {
  const arena = read("src/modules/academy/components/LiveArena.tsx");
  it("has Podium / Answers / Standings tabs and a report card", () => {
    for (const s of ['"podium"', '"answers"', '"standings"', "function ReportCard", "function AnswersReview", "function Standings"]) expect(arena, s).toContain(s);
    expect(arena).toMatch(/\/api\/academy\/live\/\$\{id\}\/results/);
  });
  it("plays the new live sounds", () => {
    for (const s of ['sfx("drumroll")', 'sfx("rankup")', '"streak"', '"heartbeat"']) expect(arena, s).toContain(s);
    const audio = read("src/modules/academy/client/audio.ts");
    for (const s of ["drumroll:", "rankup:", "streak:"]) expect(audio, s).toContain(s);
  });
  it("finished quizzes in the list open on the answers", () => {
    expect(read("src/modules/academy/components/LiveList.tsx")).toMatch(/\?view=results/);
  });
});
