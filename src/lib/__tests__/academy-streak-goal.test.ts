import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DAILY_GOALS, FREEZE_MAX, liveStreakFrozen, nextStreakFrozen } from "@modules/academy/lib/engine";

const read = (p: string) => readFileSync(p, "utf8");

describe("streak freezes", () => {
  it("a normal next day continues the streak and spends nothing", () => {
    expect(nextStreakFrozen("2026-11-25", 4, 1, "2026-11-26")).toMatchObject({ streak: 5, continued: true, freezesUsed: 0, freezes: 1 });
  });
  it("one missed day is covered by one freeze", () => {
    expect(nextStreakFrozen("2026-11-24", 4, 1, "2026-11-26")).toMatchObject({ streak: 5, continued: true, freezesUsed: 1, freezes: 0 });
  });
  it("two missed days need two freezes; with one it starts over", () => {
    expect(nextStreakFrozen("2026-11-23", 4, 2, "2026-11-26")).toMatchObject({ streak: 5, freezesUsed: 2, freezes: 0 });
    expect(nextStreakFrozen("2026-11-23", 4, 1, "2026-11-26")).toMatchObject({ streak: 1, continued: false, freezes: 1 });
  });
  it("every 7th day earns a freeze, never above the cap", () => {
    expect(nextStreakFrozen("2026-11-25", 6, 0, "2026-11-26")).toMatchObject({ streak: 7, earned: true, freezes: 1 });
    expect(nextStreakFrozen("2026-11-25", 13, FREEZE_MAX, "2026-11-26")).toMatchObject({ streak: 14, earned: false, freezes: FREEZE_MAX });
  });
  it("a second quiz the same day changes nothing", () => {
    expect(nextStreakFrozen("2026-11-26", 4, 1, "2026-11-26")).toMatchObject({ streak: 4, continued: false, freezesUsed: 0 });
  });
  it("the shown streak stays alive while freezes cover the gap", () => {
    expect(liveStreakFrozen("2026-11-25", 4, 0, "2026-11-26")).toBe(4);
    expect(liveStreakFrozen("2026-11-24", 4, 1, "2026-11-26")).toBe(4);
    expect(liveStreakFrozen("2026-11-24", 4, 0, "2026-11-26")).toBe(0);
  });
  it("finishing a quiz uses the frozen streak and stores the freezes", () => {
    const q = read("src/modules/academy/lib/quiz.ts");
    expect(q).toMatch(/nextStreakFrozen\(prof\.lastActiveDay, prof\.streak, prof\.freezes, today\)/);
    expect(q).toMatch(/freezes: s\.freezes,/);
  });
});

describe("daily goal", () => {
  it("goals are fixed choices", () => {
    expect([...DAILY_GOALS]).toEqual([20, 50, 100, 150]);
  });
  it("is set through a rate-limited PATCH that only accepts those choices", () => {
    const r = read("src/app/api/academy/me/route.ts");
    expect(r).toMatch(/export async function PATCH/);
    expect(r).toMatch(/rateLimit\("academy", me\.id\)/);
    expect(r).toMatch(/DAILY_GOALS as readonly number\[\]\)\.includes\(n\)/);
  });
  it("the dashboard opens with the goal strip", () => {
    expect(read("src/modules/academy/components/Dashboard.tsx")).toMatch(/<DailyGoal me=\{me\}/);
  });
});

describe("streak reminder push", () => {
  const r = read("src/app/api/academy/remind/route.ts");
  it("is cron-authenticated, once per learner per day, and marks before sending", () => {
    expect(r).toMatch(/checkCronAuth\(env\.CRON_SECRET/);
    expect(r).toMatch(/remindedDay: \{ not: today \}/);
    expect(r.indexOf("data: { remindedDay: today }")).toBeLessThan(r.indexOf("sendPush("));
  });
  it("respects devices with notifications off and prunes dead subscriptions", () => {
    expect(r).toMatch(/NOT: \{ notifyMode: "off" \}/);
    expect(r).toMatch(/pushSubscription\.deleteMany/);
  });
  it("runs once a day at 14:30 UTC (8 PM IST) on Vercel Cron", () => {
    const v = JSON.parse(read("vercel.json"));
    expect(v.crons).toEqual([{ path: "/api/academy/remind", schedule: "30 14 * * *" }]);
  });
});
