// Pure trading math for /tools. No React, no fetch - every function is a
// plain typed transform, unit-tested in isolation, and reusable later by the
// Trading Journal's analytics/risk engines. Mirrors the style of
// src/lib/timeseries.ts (pure helpers, sibling __tests__ file).

export type Side = "long" | "short";

/**
 * Estimated funding paid/received over a holding period. Perp venues quote
 * funding as a periodic (commonly hourly) fraction of notional; positive
 * funding = longs pay shorts, negative = shorts pay longs. Returns a signed
 * USD amount: positive = you pay, negative = you receive.
 */
export function fundingFee(args: {
  notionalUsd: number;
  hourlyRate: number; // e.g. 0.0001 = 0.01%/hr
  holdingHours: number;
  side: Side;
}): number {
  const raw = args.notionalUsd * args.hourlyRate * args.holdingHours;
  return args.side === "long" ? raw : -raw;
}

/**
 * "What-if" points/airdrop value estimator - a pure projection from
 * user-supplied assumptions. No perp DEX publishes real-time points-to-token
 * conversion data, so this is always an estimate, never a live figure.
 */
export function airdropValue(args: {
  yourPoints: number;
  totalPoolPoints: number;
  allocationPctOfSupply: number; // % of total supply allocated to the airdrop
  totalSupply: number;
  priceUsd: number; // token price assumption (derive from FDV via priceFromFdv, or enter directly)
}): { sharePct: number; tokens: number; usd: number } {
  const sharePct = args.totalPoolPoints > 0 ? (args.yourPoints / args.totalPoolPoints) * 100 : 0;
  const airdropTokens = args.totalSupply * (args.allocationPctOfSupply / 100);
  const tokens = airdropTokens * (sharePct / 100);
  const usd = tokens * args.priceUsd;
  return { sharePct, tokens, usd };
}

export function priceFromFdv(fdvUsd: number, totalSupply: number): number {
  return totalSupply > 0 ? fdvUsd / totalSupply : 0;
}

/**
 * Simplified isolated-margin liquidation price. An editable
 * maintenance-margin-rate approximation - ignores cross-margin and funding
 * accrual, so it's a planning estimate, not exchange-exact.
 */
export function liquidationPrice(args: {
  entryPrice: number;
  leverage: number;
  side: Side;
  mmrPct: number; // maintenance margin rate, e.g. 0.5 = 0.5%
}): number {
  if (args.leverage <= 0) return 0;
  const mmr = args.mmrPct / 100;
  const move = 1 / args.leverage - mmr;
  return args.side === "long" ? args.entryPrice * (1 - move) : args.entryPrice * (1 + move);
}

/** Realized (or mark-to-market) P&L on a position, net of fees. */
export function pnl(args: {
  entryPrice: number;
  exitPrice: number;
  notionalUsd: number;
  side: Side;
  feePct?: number; // percent of notional, both legs combined
}): { grossPnl: number; fees: number; netPnl: number; roiPct: number } {
  const units = args.entryPrice > 0 ? args.notionalUsd / args.entryPrice : 0;
  const direction = args.side === "long" ? 1 : -1;
  const grossPnl = units * (args.exitPrice - args.entryPrice) * direction;
  const fees = args.notionalUsd * ((args.feePct ?? 0) / 100);
  const netPnl = grossPnl - fees;
  const roiPct = args.notionalUsd > 0 ? (netPnl / args.notionalUsd) * 100 : 0;
  return { grossPnl, fees, netPnl, roiPct };
}

/** Position size from account risk: how big a position for a given risk %+stop distance. */
export function positionSize(args: {
  equityUsd: number;
  riskPct: number; // e.g. 1 = risk 1% of equity
  entryPrice: number;
  stopPrice: number;
}): { units: number; notionalUsd: number; riskUsd: number; leverageNeeded: number } {
  const riskUsd = args.equityUsd * (args.riskPct / 100);
  const stopDistance = Math.abs(args.entryPrice - args.stopPrice);
  const units = stopDistance > 0 ? riskUsd / stopDistance : 0;
  const notionalUsd = units * args.entryPrice;
  const leverageNeeded = args.equityUsd > 0 ? notionalUsd / args.equityUsd : 0;
  return { units, notionalUsd, riskUsd, leverageNeeded };
}

/** Risk:Reward ratio from a planned entry/stop/target. */
export function riskReward(args: { entryPrice: number; stopPrice: number; targetPrice: number }): number {
  const risk = Math.abs(args.entryPrice - args.stopPrice);
  const reward = Math.abs(args.targetPrice - args.entryPrice);
  return risk > 0 ? reward / risk : 0;
}
