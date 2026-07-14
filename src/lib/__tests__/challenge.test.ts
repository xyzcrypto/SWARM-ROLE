import { describe, expect, it } from "vitest";
import {
  buildLeaderboard,
  currentCapital,
  daysElapsed,
  daysRemaining,
  isExpired,
  participantPnl,
  progressTowardTarget,
  returnPct,
  totalDurationDays,
  type ChallengeLike,
  type ChallengeTrade,
} from "../challenge";

const fill = (kind: "entry" | "exit", price: number, size: number) => ({ kind, price, size, fee: 0 });

const winner: ChallengeTrade = { side: "long", fills: [fill("entry", 100, 1), fill("exit", 110, 1)] };
const loser: ChallengeTrade = { side: "long", fills: [fill("entry", 100, 1), fill("exit", 90, 1)] };
const open: ChallengeTrade = { side: "long", fills: [fill("entry", 100, 1)] };

describe("participantPnl", () => {
  it("sums realized P&L across closed trades, ignoring open ones", () => {
    expect(participantPnl([winner, loser, open])).toBeCloseTo(0);
  });
});

describe("currentCapital / returnPct", () => {
  it("adds P&L to the starting capital", () => {
    expect(currentCapital(1000, 100)).toBe(1100);
  });
  it("computes % return", () => {
    expect(returnPct(1000, 1100)).toBeCloseTo(10);
  });
  it("is 0 with a zero starting capital", () => {
    expect(returnPct(0, 1100)).toBe(0);
  });
});

describe("progressTowardTarget", () => {
  const c: ChallengeLike = { startDate: "2026-01-01", endDate: "2026-02-01", startingCapital: 1000, targetCapital: 1200 };
  it("computes % of the way from start to target", () => {
    expect(progressTowardTarget(c, 1100)).toBeCloseTo(50);
  });
  it("can exceed 100% past the target", () => {
    expect(progressTowardTarget(c, 1300)).toBeCloseTo(150);
  });
  it("returns null without a target", () => {
    expect(progressTowardTarget({ ...c, targetCapital: null }, 1100)).toBeNull();
  });
});

describe("duration / elapsed / remaining / expired", () => {
  const c: ChallengeLike = { startDate: "2026-01-01T00:00:00Z", endDate: "2026-01-31T00:00:00Z", startingCapital: 1000 };
  it("computes total duration in days", () => {
    expect(totalDurationDays(c)).toBe(30);
  });
  it("clamps elapsed days to the challenge window", () => {
    expect(daysElapsed(c, new Date("2026-01-10T00:00:00Z"))).toBe(9);
    expect(daysElapsed(c, new Date("2026-03-01T00:00:00Z"))).toBe(30);
  });
  it("computes remaining days", () => {
    expect(daysRemaining(c, new Date("2026-01-10T00:00:00Z"))).toBe(21);
  });
  it("flags expiry past the end date", () => {
    expect(isExpired(c, new Date("2026-01-10T00:00:00Z"))).toBe(false);
    expect(isExpired(c, new Date("2026-02-01T00:00:00Z"))).toBe(true);
  });
});

describe("buildLeaderboard", () => {
  it("ranks participants by return %, best first", () => {
    const participants = [
      { userId: "a", name: "Alice" },
      { userId: "b", name: "Bob" },
    ];
    const tradesByUserId = new Map<string, ChallengeTrade[]>([
      ["a", [loser]],
      ["b", [winner]],
    ]);
    const board = buildLeaderboard(participants, tradesByUserId, 1000);
    expect(board[0].userId).toBe("b");
    expect(board[0].returnPct).toBeGreaterThan(board[1].returnPct);
  });
  it("handles a participant with no trades yet", () => {
    const board = buildLeaderboard([{ userId: "a", name: "Alice" }], new Map(), 1000);
    expect(board[0].capital).toBe(1000);
    expect(board[0].returnPct).toBe(0);
  });
});
