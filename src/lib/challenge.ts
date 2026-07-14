// Trading OS Phase 4 - challenge progress math. Progress is DERIVED from the
// trades linked to a challenge (Trade.challengeId) + its startingCapital,
// never stored redundantly - same client-computed philosophy as the rest of
// the journal. No React, no Prisma types - plain data in, plain data out.

import { deriveStatus, realizedPnl, type Fill } from "./journal";

export type ChallengeTrade = { side: string; fills: Fill[] };

export type ChallengeLike = {
  startDate: string;
  endDate: string;
  startingCapital: number;
  targetCapital?: number | null;
};

/** Net realized P&L across a set of trades linked to one challenge/participant. */
export function participantPnl(trades: ChallengeTrade[]): number {
  return trades.filter((t) => deriveStatus(t.fills) !== "open").reduce((s, t) => s + realizedPnl(t.side, t.fills), 0);
}

export function currentCapital(startingCapital: number, pnl: number): number {
  return startingCapital + pnl;
}

export function returnPct(startingCapital: number, capital: number): number {
  if (startingCapital <= 0) return 0;
  return ((capital - startingCapital) / startingCapital) * 100;
}

/** % of the way from starting capital to the target - can exceed 100 or go negative. Null without a target. */
export function progressTowardTarget(c: ChallengeLike, capital: number): number | null {
  if (c.targetCapital == null || c.targetCapital === c.startingCapital) return null;
  return ((capital - c.startingCapital) / (c.targetCapital - c.startingCapital)) * 100;
}

export function totalDurationDays(c: ChallengeLike): number {
  return Math.max(1, Math.round((new Date(c.endDate).getTime() - new Date(c.startDate).getTime()) / 86_400_000));
}

export function daysElapsed(c: ChallengeLike, now: Date): number {
  const elapsed = (now.getTime() - new Date(c.startDate).getTime()) / 86_400_000;
  return Math.min(totalDurationDays(c), Math.max(0, Math.round(elapsed)));
}

export function daysRemaining(c: ChallengeLike, now: Date): number {
  return Math.max(0, totalDurationDays(c) - daysElapsed(c, now));
}

export function isExpired(c: ChallengeLike, now: Date): boolean {
  return now.getTime() > new Date(c.endDate).getTime();
}

export type LeaderboardEntry = {
  userId: string;
  name: string;
  capital: number;
  returnPct: number;
  trades: number;
};

/** Ranks participants by return %, best first. `tradesByUserId` should already be scoped to this challenge. */
export function buildLeaderboard(
  participants: { userId: string; name: string }[],
  tradesByUserId: Map<string, ChallengeTrade[]>,
  startingCapital: number
): LeaderboardEntry[] {
  return participants
    .map((p) => {
      const trades = tradesByUserId.get(p.userId) ?? [];
      const pnl = participantPnl(trades);
      const capital = currentCapital(startingCapital, pnl);
      return { userId: p.userId, name: p.name, capital, returnPct: returnPct(startingCapital, capital), trades: trades.length };
    })
    .sort((a, b) => b.returnPct - a.returnPct);
}

export const DURATION_PRESETS = [
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "4 months", days: 120 },
] as const;
