import { describe, expect, it } from "vitest";
import {
  correlatedExposure,
  currentLosingStreak,
  highLeverageTrades,
  isRevengeTrade,
  plannedRiskPct,
  plannedRiskUsd,
  ruleAdherenceScore,
  safeModeActive,
  scanBreaches,
  todaysPnl,
  tradesOpenedToday,
  weeklyPnl,
  type RiskTrade,
} from "../risk";

const fill = (kind: "entry" | "exit", price: number, size: number, executedAt: string) => ({ kind, price, size, fee: 0, executedAt });

const NOW = new Date("2026-01-10T12:00:00Z");

function trade(over: Partial<RiskTrade> & { id: string; fills: RiskTrade["fills"] }): RiskTrade {
  return { side: "long", symbol: "BTC", ...over };
}

describe("plannedRiskUsd / plannedRiskPct", () => {
  it("computes dollar risk from stop distance x entry size", () => {
    const t = trade({ id: "1", stopLoss: 95, fills: [fill("entry", 100, 2, "2026-01-10T00:00:00Z")] });
    expect(plannedRiskUsd(t)).toBeCloseTo(10);
    expect(plannedRiskPct(t, 1000)).toBeCloseTo(1);
  });
  it("is 0 without a stop", () => {
    const t = trade({ id: "1", fills: [fill("entry", 100, 2, "2026-01-10T00:00:00Z")] });
    expect(plannedRiskUsd(t)).toBe(0);
    expect(plannedRiskPct(t, 1000)).toBeNull();
  });
});

describe("todaysPnl / tradesOpenedToday", () => {
  const closedToday = trade({
    id: "1",
    fills: [fill("entry", 100, 1, "2026-01-10T08:00:00Z"), fill("exit", 110, 1, "2026-01-10T10:00:00Z")],
  });
  const closedYesterday = trade({
    id: "2",
    fills: [fill("entry", 100, 1, "2026-01-09T08:00:00Z"), fill("exit", 90, 1, "2026-01-09T10:00:00Z")],
  });
  it("sums only trades that closed today", () => {
    expect(todaysPnl([closedToday, closedYesterday], NOW)).toBeCloseTo(10);
  });
  it("counts trades whose first entry was today", () => {
    expect(tradesOpenedToday([closedToday, closedYesterday], NOW)).toBe(1);
  });
});

describe("correlatedExposure", () => {
  it("flags symbols with more than one open position", () => {
    const t1 = trade({ id: "1", symbol: "BTC", fills: [fill("entry", 100, 1, "2026-01-10T00:00:00Z")] });
    const t2 = trade({ id: "2", symbol: "BTC", fills: [fill("entry", 101, 1, "2026-01-10T01:00:00Z")] });
    const t3 = trade({ id: "3", symbol: "ETH", fills: [fill("entry", 3000, 1, "2026-01-10T02:00:00Z")] });
    expect(correlatedExposure([t1, t2, t3])).toEqual(["BTC"]);
  });
});

describe("highLeverageTrades", () => {
  it("flags open trades above the leverage threshold", () => {
    const t = trade({ id: "1", leverage: 25, fills: [fill("entry", 100, 1, "2026-01-10T00:00:00Z")] });
    expect(highLeverageTrades([t], 10)).toHaveLength(1);
  });
  it("ignores closed trades", () => {
    const t = trade({ id: "1", leverage: 25, fills: [fill("entry", 100, 1, "2026-01-10T00:00:00Z"), fill("exit", 110, 1, "2026-01-10T01:00:00Z")] });
    expect(highLeverageTrades([t], 10)).toHaveLength(0);
  });
});

describe("isRevengeTrade", () => {
  it("flags a trade opened soon after a loss", () => {
    const loser = trade({ id: "1", fills: [fill("entry", 100, 1, "2026-01-10T08:00:00Z"), fill("exit", 90, 1, "2026-01-10T08:30:00Z")] });
    const revenge = trade({ id: "2", fills: [fill("entry", 90, 1, "2026-01-10T08:40:00Z")] });
    expect(isRevengeTrade(revenge, [loser, revenge], 30)).toBe(true);
  });
  it("does not flag a trade opened well after the cooldown", () => {
    const loser = trade({ id: "1", fills: [fill("entry", 100, 1, "2026-01-10T08:00:00Z"), fill("exit", 90, 1, "2026-01-10T08:30:00Z")] });
    const later = trade({ id: "2", fills: [fill("entry", 90, 1, "2026-01-10T10:00:00Z")] });
    expect(isRevengeTrade(later, [loser, later], 30)).toBe(false);
  });
});

describe("currentLosingStreak", () => {
  it("counts consecutive losses back from the most recent close", () => {
    const win = trade({ id: "1", fills: [fill("entry", 100, 1, "2026-01-08T00:00:00Z"), fill("exit", 110, 1, "2026-01-08T01:00:00Z")] });
    const loss1 = trade({ id: "2", fills: [fill("entry", 100, 1, "2026-01-09T00:00:00Z"), fill("exit", 90, 1, "2026-01-09T01:00:00Z")] });
    const loss2 = trade({ id: "3", fills: [fill("entry", 100, 1, "2026-01-10T00:00:00Z"), fill("exit", 90, 1, "2026-01-10T01:00:00Z")] });
    expect(currentLosingStreak([win, loss1, loss2])).toBe(2);
  });
});

describe("scanBreaches / ruleAdherenceScore / safeModeActive", () => {
  it("flags a daily loss breach and scores it critical", () => {
    const t = trade({ id: "1", fills: [fill("entry", 100, 10, "2026-01-10T08:00:00Z"), fill("exit", 90, 10, "2026-01-10T09:00:00Z")] });
    const breaches = scanBreaches([t], { maxDailyLossPct: 2, accountEquity: 1000 }, NOW);
    expect(breaches.some((b) => b.rule === "daily-loss" && b.severity === "critical")).toBe(true);
    expect(ruleAdherenceScore(breaches)).toBeLessThan(100);
  });
  it("returns a perfect score with no breaches", () => {
    expect(ruleAdherenceScore([])).toBe(100);
  });
  it("safe mode activates after 3 consecutive losses", () => {
    const losses = [1, 2, 3].map((n) =>
      trade({ id: String(n), fills: [fill("entry", 100, 1, `2026-01-0${n}T00:00:00Z`), fill("exit", 90, 1, `2026-01-0${n}T01:00:00Z`)] })
    );
    expect(safeModeActive(losses)).toBe(true);
  });
  it("sums realized P&L for trades closed within the trailing 7 days", () => {
    const closedThisWeek = trade({
      id: "1",
      fills: [fill("entry", 100, 1, "2026-01-06T00:00:00Z"), fill("exit", 90, 1, "2026-01-06T01:00:00Z")],
    });
    const closedLastMonth = trade({
      id: "2",
      fills: [fill("entry", 100, 1, "2025-12-01T00:00:00Z"), fill("exit", 90, 1, "2025-12-01T01:00:00Z")],
    });
    expect(weeklyPnl([closedThisWeek, closedLastMonth], NOW)).toBeCloseTo(-10);
  });
  it("flags a weekly drawdown breach and scores it critical", () => {
    const t = trade({ id: "1", fills: [fill("entry", 100, 10, "2026-01-06T08:00:00Z"), fill("exit", 90, 10, "2026-01-06T09:00:00Z")] });
    const breaches = scanBreaches([t], { maxWeeklyDrawdownPct: 5, accountEquity: 1000 }, NOW);
    expect(breaches.some((b) => b.rule === "weekly-drawdown" && b.severity === "critical")).toBe(true);
  });
});
