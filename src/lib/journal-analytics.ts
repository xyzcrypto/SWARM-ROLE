// Deeper Trading Journal analytics - all pure functions over the same trade
// list already fetched for the Trades tab (no new endpoint, same
// client-computed philosophy as src/lib/journal.ts). Every metric here is
// DERIVED, nothing is stored redundantly.

import {
  deriveStatus,
  entrySize,
  realizedPnl,
  totalFees,
  weightedAvgPrice,
  type Fill,
  type EquityPoint,
} from "./journal";

export type AnalyzableTrade = {
  side: string;
  fills: (Fill & { executedAt: string })[];
  stopLoss?: number | null;
  takeProfit?: number | null;
  symbol: string;
  setup?: string | null;
  session?: string | null;
  platformId?: string | null;
  mistakes?: string[];
};

function closedOnly(trades: AnalyzableTrade[]): AnalyzableTrade[] {
  return trades.filter((t) => deriveStatus(t.fills) !== "open");
}

function lastExitAt(fills: (Fill & { executedAt: string })[]): string {
  const exits = fills.filter((f) => f.kind === "exit");
  return exits.reduce((latest, f) => (f.executedAt > latest ? f.executedAt : latest), exits[0]?.executedAt ?? "");
}

function firstEntryAt(fills: (Fill & { executedAt: string })[]): string {
  const entries = fills.filter((f) => f.kind === "entry");
  return entries.reduce((earliest, f) => (earliest === "" || f.executedAt < earliest ? f.executedAt : earliest), "");
}

/** Gross P&L (before fees) for a single trade - net + fees, since realizedPnl already subtracts them. */
export function grossPnl(t: AnalyzableTrade): number {
  return realizedPnl(t.side, t.fills) + totalFees(t.fills);
}

/** Profit factor: gross profit / gross loss across closed trades. Null when there are no losses to divide by. */
export function profitFactor(trades: AnalyzableTrade[]): number | null {
  const pnls = closedOnly(trades).map((t) => realizedPnl(t.side, t.fills));
  const grossProfit = pnls.filter((p) => p > 0).reduce((s, p) => s + p, 0);
  const grossLoss = Math.abs(pnls.filter((p) => p < 0).reduce((s, p) => s + p, 0));
  if (grossLoss === 0) return null;
  return grossProfit / grossLoss;
}

/** Average net P&L per closed trade. */
export function expectancy(trades: AnalyzableTrade[]): number {
  const closed = closedOnly(trades);
  if (closed.length === 0) return 0;
  const total = closed.reduce((s, t) => s + realizedPnl(t.side, t.fills), 0);
  return total / closed.length;
}

/** Realized R-multiple for one trade: actual P&L expressed as a multiple of the
 * initial planned risk (entry-to-stop distance x entry size). Null if no stop was set. */
export function realizedR(t: AnalyzableTrade): number | null {
  if (t.stopLoss == null) return null;
  const avgEntry = weightedAvgPrice(t.fills, "entry");
  const riskPerUnit = Math.abs(avgEntry - t.stopLoss);
  const size = entrySize(t.fills);
  const riskAmount = riskPerUnit * size;
  if (riskAmount === 0) return null;
  return realizedPnl(t.side, t.fills) / riskAmount;
}

export function realizedRMultiples(trades: AnalyzableTrade[]): number[] {
  return closedOnly(trades)
    .map((t) => realizedR(t))
    .filter((r): r is number => r !== null);
}

/** Largest peak-to-trough decline in cumulative P&L, as a positive dollar amount. */
export function maxDrawdown(curve: EquityPoint[]): number {
  let peak = 0;
  let worst = 0;
  for (const p of curve) {
    if (p.cumPnl > peak) peak = p.cumPnl;
    worst = Math.max(worst, peak - p.cumPnl);
  }
  return worst;
}

/** Drawdown at each equity-curve point (peak-so-far minus current), as negative values for the shared chart. */
export function drawdownCurve(curve: EquityPoint[]): EquityPoint[] {
  let peak = 0;
  return curve.map((p) => {
    peak = Math.max(peak, p.cumPnl);
    return { date: p.date, cumPnl: -(peak - p.cumPnl) || 0 }; // `|| 0` normalizes -0 to 0
  });
}

export type PeriodBucket = { period: string; pnl: number; trades: number };

/** Exported so callers can compute "today"/"this week"/"this month" the same
 * way periodBreakdown buckets trades - keeps the two in sync (e.g. finding the
 * current-period bucket to highlight, without re-deriving the ISO-week math). */
export function periodKey(iso: string, granularity: "day" | "week" | "month"): string {
  const d = new Date(iso);
  if (granularity === "day") return iso.slice(0, 10);
  if (granularity === "month") return iso.slice(0, 7);
  // ISO week (Monday-start), labeled by the Monday's date.
  const day = (d.getUTCDay() + 6) % 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - day);
  return monday.toISOString().slice(0, 10);
}

/** P&L bucketed by day/week/month, based on each trade's last exit. */
export function periodBreakdown(trades: AnalyzableTrade[], granularity: "day" | "week" | "month"): PeriodBucket[] {
  const buckets = new Map<string, PeriodBucket>();
  for (const t of closedOnly(trades)) {
    const exitAt = lastExitAt(t.fills);
    if (!exitAt) continue;
    const key = periodKey(exitAt, granularity);
    const existing = buckets.get(key) ?? { period: key, pnl: 0, trades: 0 };
    existing.pnl += realizedPnl(t.side, t.fills);
    existing.trades += 1;
    buckets.set(key, existing);
  }
  return Array.from(buckets.values()).sort((a, b) => (a.period < b.period ? -1 : 1));
}

export type GroupStat = { key: string; totalPnl: number; trades: number; winRate: number };

/** Groups closed trades by an arbitrary key (setup/symbol/platform/session), sorted best P&L first. */
export function groupBy(trades: AnalyzableTrade[], keyFn: (t: AnalyzableTrade) => string | null | undefined): GroupStat[] {
  const groups = new Map<string, AnalyzableTrade[]>();
  for (const t of closedOnly(trades)) {
    const key = keyFn(t) || "Unspecified";
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return Array.from(groups.entries())
    .map(([key, ts]) => {
      const pnls = ts.map((t) => realizedPnl(t.side, t.fills));
      const wins = pnls.filter((p) => p > 0).length;
      return { key, totalPnl: pnls.reduce((s, p) => s + p, 0), trades: ts.length, winRate: (wins / ts.length) * 100 };
    })
    .sort((a, b) => b.totalPnl - a.totalPnl);
}

export function bestWorst(groups: GroupStat[]): { best: GroupStat | null; worst: GroupStat | null } {
  if (groups.length === 0) return { best: null, worst: null };
  return { best: groups[0], worst: groups[groups.length - 1] };
}

export type SideSummary = { side: "long" | "short"; trades: number; winRate: number; totalPnl: number };

/** Performance split by long vs. short. */
export function longVsShort(trades: AnalyzableTrade[]): SideSummary[] {
  return (["long", "short"] as const).map((side) => {
    const ts = closedOnly(trades).filter((t) => t.side === side);
    const pnls = ts.map((t) => realizedPnl(t.side, t.fills));
    const wins = pnls.filter((p) => p > 0).length;
    return {
      side,
      trades: ts.length,
      winRate: ts.length > 0 ? (wins / ts.length) * 100 : 0,
      totalPnl: pnls.reduce((s, p) => s + p, 0),
    };
  });
}

/** Average hold time (first entry to last exit) across closed trades, in hours. */
export function avgHoldTimeHours(trades: AnalyzableTrade[]): number | null {
  const closed = closedOnly(trades);
  const durations = closed
    .map((t) => {
      const start = firstEntryAt(t.fills);
      const end = lastExitAt(t.fills);
      if (!start || !end) return null;
      return (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
    })
    .filter((h): h is number => h !== null);
  if (durations.length === 0) return null;
  return durations.reduce((s, h) => s + h, 0) / durations.length;
}

/** A closed trade "exited early" when a take-profit was set but no exit fill reached it. */
export function isEarlyExit(t: AnalyzableTrade): boolean {
  if (t.takeProfit == null) return false;
  const exits = t.fills.filter((f) => f.kind === "exit");
  if (exits.length === 0) return false;
  if (t.side === "long") return Math.max(...exits.map((f) => f.price)) < t.takeProfit;
  return Math.min(...exits.map((f) => f.price)) > t.takeProfit;
}

export function earlyExitRate(trades: AnalyzableTrade[]): number {
  const withTarget = closedOnly(trades).filter((t) => t.takeProfit != null);
  if (withTarget.length === 0) return 0;
  return (withTarget.filter(isEarlyExit).length / withTarget.length) * 100;
}

export type MistakeCount = { mistake: string; count: number };

/** Frequency of each mistake tag across all trades, most common first. */
export function mistakeFrequency(trades: AnalyzableTrade[]): MistakeCount[] {
  const counts = new Map<string, number>();
  for (const t of trades) {
    for (const m of t.mistakes ?? []) counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([mistake, count]) => ({ mistake, count }))
    .sort((a, b) => b.count - a.count);
}
