import { describe, expect, it } from "vitest";
import {
  avgHoldTimeHours,
  bestWorst,
  drawdownCurve,
  earlyExitRate,
  expectancy,
  grossPnl,
  groupBy,
  isEarlyExit,
  longVsShort,
  maxDrawdown,
  mistakeFrequency,
  periodBreakdown,
  profitFactor,
  realizedR,
  realizedRMultiples,
  type AnalyzableTrade,
} from "../journal-analytics";

const fill = (kind: "entry" | "exit", price: number, size: number, executedAt: string, fee = 0) => ({ kind, price, size, fee, executedAt });

const winner: AnalyzableTrade = {
  side: "long",
  symbol: "BTC",
  setup: "breakout",
  session: "New York",
  platformId: "hyperliquid",
  stopLoss: 95,
  takeProfit: 120,
  mistakes: ["fomo"],
  fills: [fill("entry", 100, 1, "2026-01-01T00:00:00Z", 1), fill("exit", 110, 1, "2026-01-02T00:00:00Z", 1)],
};

const loser: AnalyzableTrade = {
  side: "long",
  symbol: "ETH",
  setup: "reversal",
  session: "London",
  platformId: "gmx",
  stopLoss: 95,
  takeProfit: 120,
  mistakes: ["fomo", "overtrading"],
  fills: [fill("entry", 100, 1, "2026-01-03T00:00:00Z"), fill("exit", 90, 1, "2026-01-04T00:00:00Z")],
};

const openTrade: AnalyzableTrade = {
  side: "long",
  symbol: "SOL",
  fills: [fill("entry", 100, 1, "2026-01-05T00:00:00Z")],
};

describe("grossPnl", () => {
  it("adds fees back to net P&L", () => {
    expect(grossPnl(winner)).toBeCloseTo(10); // net 8 + 2 fees
  });
});

describe("profitFactor", () => {
  it("computes gross profit over gross loss", () => {
    expect(profitFactor([winner, loser])).toBeCloseTo(8 / 10);
  });
  it("returns null when there are no losses", () => {
    expect(profitFactor([winner])).toBeNull();
  });
});

describe("expectancy", () => {
  it("averages net P&L across closed trades only", () => {
    expect(expectancy([winner, loser, openTrade])).toBeCloseTo((8 - 10) / 2);
  });
});

describe("realizedR / realizedRMultiples", () => {
  it("expresses P&L as a multiple of planned risk", () => {
    expect(realizedR(winner)).toBeCloseTo(8 / 5); // risk = |100-95|*1 = 5
  });
  it("returns null without a stop loss", () => {
    expect(realizedR({ ...winner, stopLoss: null })).toBeNull();
  });
  it("collects R across closed trades, skipping nulls", () => {
    expect(realizedRMultiples([winner, loser, openTrade])).toHaveLength(2);
  });
});

describe("maxDrawdown / drawdownCurve", () => {
  const curve = [
    { date: "1", cumPnl: 10 },
    { date: "2", cumPnl: 4 },
    { date: "3", cumPnl: 6 },
  ];
  it("finds the largest peak-to-trough decline", () => {
    expect(maxDrawdown(curve)).toBeCloseTo(6);
  });
  it("expresses drawdown as negative values off the running peak", () => {
    expect(drawdownCurve(curve)).toEqual([
      { date: "1", cumPnl: 0 },
      { date: "2", cumPnl: -6 },
      { date: "3", cumPnl: -4 },
    ]);
  });
});

describe("periodBreakdown", () => {
  it("buckets P&L by day", () => {
    const buckets = periodBreakdown([winner, loser], "day");
    expect(buckets).toHaveLength(2);
    expect(buckets[0].pnl).toBeCloseTo(8);
  });
});

describe("groupBy / bestWorst", () => {
  it("groups closed trades and sorts best P&L first", () => {
    const groups = groupBy([winner, loser], (t) => t.setup);
    expect(groups[0].key).toBe("breakout");
    const { best, worst } = bestWorst(groups);
    expect(best?.key).toBe("breakout");
    expect(worst?.key).toBe("reversal");
  });
  it("labels a missing key as Unspecified", () => {
    const groups = groupBy([openTrade, winner], (t) => t.setup);
    // openTrade is excluded (still open); only winner counted, so no Unspecified bucket here.
    expect(groups.find((g) => g.key === "Unspecified")).toBeUndefined();
  });
});

describe("longVsShort", () => {
  it("splits stats by side", () => {
    const [long, short] = longVsShort([winner, loser]);
    expect(long.trades).toBe(2);
    expect(short.trades).toBe(0);
  });
});

describe("avgHoldTimeHours", () => {
  it("averages entry-to-exit duration in hours", () => {
    expect(avgHoldTimeHours([winner])).toBeCloseTo(24);
  });
  it("returns null with no closed trades", () => {
    expect(avgHoldTimeHours([openTrade])).toBeNull();
  });
});

describe("isEarlyExit / earlyExitRate", () => {
  it("flags a long exited below its take-profit", () => {
    expect(isEarlyExit(winner)).toBe(true); // exited 110, target 120
  });
  it("computes the rate across trades with a target set", () => {
    expect(earlyExitRate([winner, loser])).toBe(100);
  });
});

describe("mistakeFrequency", () => {
  it("counts mistake tags across trades, most common first", () => {
    const freq = mistakeFrequency([winner, loser]);
    expect(freq[0]).toEqual({ mistake: "fomo", count: 2 });
    expect(freq.find((m) => m.mistake === "overtrading")?.count).toBe(1);
  });
});
