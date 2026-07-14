import { describe, expect, it } from "vitest";
import {
  airdropValue,
  breakEvenPrice,
  compoundGrowth,
  drawdownRecoveryPct,
  fundingFee,
  liquidationPrice,
  pnl,
  positionSize,
  priceFromFdv,
  riskReward,
} from "../calculators";

describe("fundingFee", () => {
  it("longs pay when funding is positive", () => {
    expect(fundingFee({ notionalUsd: 10_000, hourlyRate: 0.0001, holdingHours: 8, side: "long" })).toBeCloseTo(8);
  });
  it("shorts receive when funding is positive", () => {
    expect(fundingFee({ notionalUsd: 10_000, hourlyRate: 0.0001, holdingHours: 8, side: "short" })).toBeCloseTo(-8);
  });
});

describe("priceFromFdv", () => {
  it("divides FDV by supply", () => {
    expect(priceFromFdv(1_500_000_000, 1_000_000_000)).toBeCloseTo(1.5);
  });
  it("returns 0 for zero supply", () => {
    expect(priceFromFdv(1000, 0)).toBe(0);
  });
});

describe("airdropValue", () => {
  it("computes share, tokens and usd from points and assumptions", () => {
    const r = airdropValue({
      yourPoints: 940,
      totalPoolPoints: 9_400_000,
      allocationPctOfSupply: 30,
      totalSupply: 1_000_000_000,
      priceUsd: 1.5,
    });
    expect(r.sharePct).toBeCloseTo(0.01);
    expect(r.tokens).toBeCloseTo(30_000);
    expect(r.usd).toBeCloseTo(45_000);
  });
  it("handles a zero pool without dividing by zero", () => {
    const r = airdropValue({ yourPoints: 10, totalPoolPoints: 0, allocationPctOfSupply: 5, totalSupply: 1000, priceUsd: 1 });
    expect(r.sharePct).toBe(0);
    expect(r.tokens).toBe(0);
  });
});

describe("liquidationPrice", () => {
  it("moves down for a long", () => {
    const liq = liquidationPrice({ entryPrice: 100, leverage: 10, side: "long", mmrPct: 0.5 });
    expect(liq).toBeLessThan(100);
  });
  it("moves up for a short", () => {
    const liq = liquidationPrice({ entryPrice: 100, leverage: 10, side: "short", mmrPct: 0.5 });
    expect(liq).toBeGreaterThan(100);
  });
});

describe("pnl", () => {
  it("computes gross/net/roi for a winning long", () => {
    const r = pnl({ entryPrice: 100, exitPrice: 110, notionalUsd: 1000, side: "long", feePct: 0.1 });
    expect(r.grossPnl).toBeCloseTo(100);
    expect(r.fees).toBeCloseTo(1);
    expect(r.netPnl).toBeCloseTo(99);
    expect(r.roiPct).toBeCloseTo(9.9);
  });
  it("inverts direction for a short", () => {
    const r = pnl({ entryPrice: 100, exitPrice: 90, notionalUsd: 1000, side: "short" });
    expect(r.netPnl).toBeCloseTo(100);
  });
});

describe("positionSize", () => {
  it("sizes a position from risk % and stop distance", () => {
    const r = positionSize({ equityUsd: 10_000, riskPct: 1, entryPrice: 100, stopPrice: 95 });
    expect(r.riskUsd).toBeCloseTo(100);
    expect(r.units).toBeCloseTo(20);
    expect(r.notionalUsd).toBeCloseTo(2000);
  });
});

describe("riskReward", () => {
  it("computes a 2R setup", () => {
    expect(riskReward({ entryPrice: 100, stopPrice: 95, targetPrice: 110 })).toBeCloseTo(2);
  });
  it("returns 0 when stop equals entry", () => {
    expect(riskReward({ entryPrice: 100, stopPrice: 100, targetPrice: 110 })).toBe(0);
  });
});

describe("breakEvenPrice", () => {
  it("moves up for a long by the round-trip fee", () => {
    expect(breakEvenPrice({ entryPrice: 100, side: "long", feePct: 0.1 })).toBeCloseTo(100.2);
  });
  it("moves down for a short by the round-trip fee", () => {
    expect(breakEvenPrice({ entryPrice: 100, side: "short", feePct: 0.1 })).toBeCloseTo(99.8);
  });
});

describe("compoundGrowth", () => {
  it("compounds a fixed return per period", () => {
    const r = compoundGrowth({ startingCapital: 1000, returnPctPerPeriod: 10, periods: 2 });
    expect(r.finalCapital).toBeCloseTo(1210);
    expect(r.totalGain).toBeCloseTo(210);
    expect(r.totalReturnPct).toBeCloseTo(21);
  });
  it("handles 0 periods as unchanged", () => {
    const r = compoundGrowth({ startingCapital: 1000, returnPctPerPeriod: 10, periods: 0 });
    expect(r.finalCapital).toBeCloseTo(1000);
  });
});

describe("drawdownRecoveryPct", () => {
  it("requires a 100% gain to recover from a 50% loss", () => {
    expect(drawdownRecoveryPct(50)).toBeCloseTo(100);
  });
  it("requires a smaller gain to recover from a small drawdown", () => {
    expect(drawdownRecoveryPct(10)).toBeCloseTo(11.11, 1);
  });
  it("is 0 for no drawdown", () => {
    expect(drawdownRecoveryPct(0)).toBe(0);
  });
});
