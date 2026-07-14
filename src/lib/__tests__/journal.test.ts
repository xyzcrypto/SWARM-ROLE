import { describe, expect, it } from "vitest";
import {
  computeStats,
  deriveStatus,
  entrySize,
  equityCurve,
  exitSize,
  openSize,
  realizedPnl,
  riskReward,
  totalFees,
  weightedAvgPrice,
  type Fill,
} from "../journal";

const entry = (price: number, size: number, fee = 0): Fill => ({ kind: "entry", price, size, fee });
const exit = (price: number, size: number, fee = 0): Fill => ({ kind: "exit", price, size, fee });

describe("weightedAvgPrice", () => {
  it("averages multiple entries by size", () => {
    expect(weightedAvgPrice([entry(100, 1), entry(200, 1)], "entry")).toBeCloseTo(150);
  });
  it("returns 0 for an empty set", () => {
    expect(weightedAvgPrice([], "entry")).toBe(0);
  });
});

describe("entrySize / exitSize / openSize", () => {
  it("sums fills by kind and derives remaining open size", () => {
    const fills = [entry(100, 2), exit(110, 0.5)];
    expect(entrySize(fills)).toBeCloseTo(2);
    expect(exitSize(fills)).toBeCloseTo(0.5);
    expect(openSize(fills)).toBeCloseTo(1.5);
  });
  it("never goes negative", () => {
    expect(openSize([entry(100, 1), exit(110, 1), exit(120, 1)])).toBe(0);
  });
});

describe("realizedPnl", () => {
  it("computes a winning long net of fees", () => {
    const fills = [entry(100, 1, 1), exit(110, 1, 1)];
    expect(realizedPnl("long", fills)).toBeCloseTo(8); // (110-100)*1 - 2 fees
  });
  it("inverts direction for a short", () => {
    const fills = [entry(100, 1), exit(90, 1)];
    expect(realizedPnl("short", fills)).toBeCloseTo(10);
  });
  it("is 0 with no exits", () => {
    expect(realizedPnl("long", [entry(100, 1)])).toBe(0);
  });
});

describe("deriveStatus", () => {
  it("is open with no fills or no exits", () => {
    expect(deriveStatus([])).toBe("open");
    expect(deriveStatus([entry(100, 1)])).toBe("open");
  });
  it("is partial when exit size is less than entry size", () => {
    expect(deriveStatus([entry(100, 2), exit(110, 1)])).toBe("partial");
  });
  it("is closed once exit size meets or exceeds entry size", () => {
    expect(deriveStatus([entry(100, 1), exit(110, 1)])).toBe("closed");
  });
});

describe("riskReward", () => {
  it("computes R from stop/target vs. average entry", () => {
    const r = riskReward({ side: "long", fills: [entry(100, 1)], stopLoss: 95, takeProfit: 110 });
    expect(r).toBeCloseTo(2);
  });
  it("returns null when stop or target is unset", () => {
    expect(riskReward({ side: "long", fills: [entry(100, 1)], stopLoss: null, takeProfit: 110 })).toBeNull();
  });
});

describe("totalFees", () => {
  it("sums fees across all fills", () => {
    expect(totalFees([entry(100, 1, 2), exit(110, 1, 3)])).toBeCloseTo(5);
  });
});

describe("computeStats", () => {
  it("aggregates win rate, total P&L and avg R across closed trades", () => {
    const trades = [
      { side: "long", fills: [entry(100, 1), exit(110, 1)], stopLoss: 95, takeProfit: 110 }, // win, R=2
      { side: "long", fills: [entry(100, 1), exit(90, 1)], stopLoss: 95, takeProfit: 110 }, // loss
      { side: "long", fills: [entry(100, 1)] }, // still open - excluded from win/loss
    ];
    const stats = computeStats(trades);
    expect(stats.totalTrades).toBe(3);
    expect(stats.closedTrades).toBe(2);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(1);
    expect(stats.winRate).toBeCloseTo(50);
    expect(stats.totalPnl).toBeCloseTo(0);
    expect(stats.avgR).toBeCloseTo(2);
  });
});

describe("equityCurve", () => {
  it("accumulates realized P&L in chronological order of last exit", () => {
    const trades = [
      { side: "long", fills: [{ ...entry(100, 1), executedAt: "2026-01-01" }, { ...exit(110, 1), executedAt: "2026-01-02" }] },
      { side: "long", fills: [{ ...entry(100, 1), executedAt: "2026-01-03" }, { ...exit(90, 1), executedAt: "2026-01-04" }] },
    ];
    const curve = equityCurve(trades);
    expect(curve).toHaveLength(2);
    expect(curve[0].cumPnl).toBeCloseTo(10);
    expect(curve[1].cumPnl).toBeCloseTo(0);
  });
});
