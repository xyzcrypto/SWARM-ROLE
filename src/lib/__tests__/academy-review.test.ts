import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { schedule, untilText, REVIEW_STEPS_DAYS } from "@modules/academy/lib/review";

const H = 3_600_000;
const D = 24 * H;
const T0 = Date.UTC(2026, 10, 1);
const a = (questionId: string, correct: boolean, at: number) => ({ questionId, correct, createdAt: new Date(T0 + at) });

describe("spaced review schedule", () => {
  it("uses 1, 3 and 7 day steps", () => {
    expect(REVIEW_STEPS_DAYS).toEqual([1, 3, 7]);
  });

  it("a question never missed is not in review", () => {
    const s = schedule([a("q", true, 0), a("q", true, D)], T0 + 2 * D);
    expect(s.due).toEqual([]);
    expect(s.upcoming).toEqual([]);
    expect(s.mastered).toBe(0);
  });

  it("a miss is due at once", () => {
    const s = schedule([a("q", false, 0)], T0 + 1000);
    expect(s.due).toEqual([{ questionId: "q", step: 0, dueAt: T0 }]);
  });

  it("each on-time right answer moves it out 1, 3, then 7 days, and the 4th masters it", () => {
    let rows = [a("q", false, 0), a("q", true, H)];
    expect(schedule(rows, T0 + 2 * H).upcoming[0]).toMatchObject({ step: 1, dueAt: T0 + H + 1 * D });
    rows = [...rows, a("q", true, H + D)];
    expect(schedule(rows, T0 + H + D + 1).upcoming[0]).toMatchObject({ step: 2, dueAt: T0 + H + D + 3 * D });
    rows = [...rows, a("q", true, H + 4 * D)];
    expect(schedule(rows, T0 + H + 4 * D + 1).upcoming[0]).toMatchObject({ step: 3, dueAt: T0 + H + 4 * D + 7 * D });
    rows = [...rows, a("q", true, H + 11 * D)];
    const s = schedule(rows, T0 + H + 11 * D + 1);
    expect(s.mastered).toBe(1);
    expect(s.due.length + s.upcoming.length).toBe(0);
  });

  it("a right answer given too early does not count (spacing is the point)", () => {
    // Missed, right an hour later (step 1, due +1d), then right again 2 hours after that.
    const s = schedule([a("q", false, 0), a("q", true, H), a("q", true, 3 * H)], T0 + 4 * H);
    expect(s.upcoming[0]).toMatchObject({ step: 1, dueAt: T0 + H + D });
  });

  it("a right answer within the 2h slack before due still counts", () => {
    const s = schedule([a("q", false, 0), a("q", true, H), a("q", true, H + D - H)], T0 + H + D);
    expect(s.upcoming[0]).toMatchObject({ step: 2 });
  });

  it("a new miss starts it over", () => {
    const s = schedule([a("q", false, 0), a("q", true, H), a("q", true, H + D), a("q", false, H + 2 * D)], T0 + H + 2 * D + 1);
    expect(s.due).toEqual([{ questionId: "q", step: 0, dueAt: T0 + H + 2 * D }]);
  });

  it("due is most overdue first, upcoming soonest first, nextAt is the soonest upcoming", () => {
    const s = schedule([a("x", false, 5 * H), a("y", false, 1 * H), a("z", false, 0), a("z", true, H)], T0 + 6 * H);
    expect(s.due.map((d) => d.questionId)).toEqual(["y", "x"]);
    expect(s.nextAt).toBe(T0 + H + D);
  });

  it("untilText reads naturally", () => {
    expect(untilText(T0 + 20 * 60_000, T0)).toBe("within the hour");
    expect(untilText(T0 + 5 * H, T0)).toBe("in 5h");
    expect(untilText(T0 + D, T0)).toBe("in 1 day");
    expect(untilText(T0 + 3 * D, T0)).toBe("in 3 days");
  });
});

describe("review wiring", () => {
  it("Mistakes mode serves only the due queue, and /me reports it", () => {
    const q = readFileSync("src/modules/academy/lib/quiz.ts", "utf8");
    expect(q).toMatch(/const q = await reviewQueue\(userId, now\);/);
    expect(q).toMatch(/ids: q\.due\.slice\(0, count\)\.map\(\(d\) => d\.questionId\)/);
    expect(readFileSync("src/modules/academy/lib/me.ts", "utf8")).toMatch(/review: \{ due: rq\.due\.length/);
  });
  it("the queue only offers questions that are still active", () => {
    expect(readFileSync("src/modules/academy/lib/review-db.ts", "utf8")).toMatch(/where: \{ id: \{ in: ids \}, active: true \}/);
  });
  it("the dashboard leads with the review card", () => {
    expect(readFileSync("src/modules/academy/components/Dashboard.tsx", "utf8")).toMatch(/<ReviewCard review=\{me\.review\} \/>/);
  });
});
