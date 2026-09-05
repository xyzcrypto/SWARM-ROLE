// Risk Management engine - pure functions over the same trade list already
// fetched for Trades/Analytics, plus a user's RiskProfile settings. Nothing
// here needs a new endpoint beyond persisting the profile itself; breach
// detection, planned-vs-actual risk, and the rule-adherence score are all
// computed client-side, same philosophy as journal.ts / journal-analytics.ts.

import { deriveStatus, entrySize, realizedPnl, weightedAvgPrice, type Fill } from "@/lib/journal";

export type RiskTrade = {
  id: string;
  side: string;
  symbol: string;
  leverage?: number | null;
  stopLoss?: number | null;
  fills: (Fill & { executedAt: string })[];
};

export type RiskProfile = {
  maxRiskPerTradePct?: number | null;
  maxDailyLossPct?: number | null;
  maxWeeklyDrawdownPct?: number | null;
  maxOpenRiskPct?: number | null;
  accountEquity?: number | null;
  revengeCooldownMinutes?: number | null;
  maxTradesPerDay?: number | null;
  maxLeverage?: number | null;
};

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function firstEntryAt(fills: (Fill & { executedAt: string })[]): string {
  const entries = fills.filter((f) => f.kind === "entry");
  return entries.reduce((earliest, f) => (earliest === "" || f.executedAt < earliest ? f.executedAt : earliest), "");
}

function lastExitAt(fills: (Fill & { executedAt: string })[]): string {
  const exits = fills.filter((f) => f.kind === "exit");
  return exits.reduce((latest, f) => (f.executedAt > latest ? f.executedAt : latest), exits[0]?.executedAt ?? "");
}

/** Dollar risk on a single trade: |avg entry - stop| x entry size. 0 without a stop. */
export function plannedRiskUsd(t: RiskTrade): number {
  if (t.stopLoss == null) return 0;
  const avgEntry = weightedAvgPrice(t.fills, "entry");
  return Math.abs(avgEntry - t.stopLoss) * entrySize(t.fills);
}

/** Planned risk as % of account equity - null without an equity baseline or a stop. */
export function plannedRiskPct(t: RiskTrade, equity: number | null | undefined): number | null {
  if (!equity || equity <= 0 || t.stopLoss == null) return null;
  return (plannedRiskUsd(t) / equity) * 100;
}

export type Breach = { rule: string; severity: "warn" | "critical"; message: string };

/** Net realized P&L for trades closed today (local calendar day per executedAt). */
export function todaysPnl(trades: RiskTrade[], now: Date): number {
  const today = now.toISOString().slice(0, 10);
  return trades
    .filter((t) => deriveStatus(t.fills) !== "open" && dayKey(lastExitAt(t.fills)) === today)
    .reduce((s, t) => s + realizedPnl(t.side, t.fills), 0);
}

/** Net realized P&L for trades closed within the trailing 7 days (from `now`). */
export function weeklyPnl(trades: RiskTrade[], now: Date): number {
  const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  return trades
    .filter((t) => deriveStatus(t.fills) !== "open" && new Date(lastExitAt(t.fills)).getTime() >= cutoff)
    .reduce((s, t) => s + realizedPnl(t.side, t.fills), 0);
}

/** How many NEW trades were opened today (by first entry fill). */
export function tradesOpenedToday(trades: RiskTrade[], now: Date): number {
  const today = now.toISOString().slice(0, 10);
  return trades.filter((t) => dayKey(firstEntryAt(t.fills)) === today).length;
}

/** Symbols with more than one concurrently OPEN position - correlated/duplicated exposure. */
export function correlatedExposure(trades: RiskTrade[]): string[] {
  const open = trades.filter((t) => deriveStatus(t.fills) === "open");
  const counts = new Map<string, number>();
  for (const t of open) counts.set(t.symbol, (counts.get(t.symbol) ?? 0) + 1);
  return Array.from(counts.entries())
    .filter(([, n]) => n > 1)
    .map(([symbol]) => symbol);
}

/** Currently open trades using leverage above the configured (or default 10x) threshold. */
export function highLeverageTrades(trades: RiskTrade[], maxLeverage = 10): RiskTrade[] {
  return trades.filter((t) => deriveStatus(t.fills) === "open" && (t.leverage ?? 1) > maxLeverage);
}

/** A trade counts as "revenge" when opened within `cooldownMinutes` of the prior trade's LOSING exit. */
export function isRevengeTrade(trade: RiskTrade, priorTrades: RiskTrade[], cooldownMinutes: number): boolean {
  const openedAt = firstEntryAt(trade.fills);
  if (!openedAt) return false;
  const openedTime = new Date(openedAt).getTime();
  const maxGapMs = cooldownMinutes * 60_000;

  for (const t of priorTrades) {
    if (t.id === trade.id) continue;
    if (deriveStatus(t.fills) === "open") continue;
    if (realizedPnl(t.side, t.fills) >= 0) continue;
    const exitAt = lastExitAt(t.fills);
    if (!exitAt) continue;
    const gapMs = openedTime - new Date(exitAt).getTime();
    if (gapMs >= 0 && gapMs < maxGapMs) {
      return true;
    }
  }
  return false;
}

/** Consecutive losing trades counting back from the most recently closed. */
export function currentLosingStreak(trades: RiskTrade[]): number {
  const closed = trades
    .filter((t) => deriveStatus(t.fills) !== "open")
    .map((t) => ({ pnl: realizedPnl(t.side, t.fills), exitAt: lastExitAt(t.fills) }))
    .sort((a, b) => (a.exitAt < b.exitAt ? 1 : -1)); // newest first
  let streak = 0;
  for (const t of closed) {
    if (t.pnl < 0) streak += 1;
    else break;
  }
  return streak;
}

/** Full breach scan against a profile's configured limits, as of `now`. */
export function scanBreaches(trades: RiskTrade[], profile: RiskProfile, now: Date): Breach[] {
  const breaches: Breach[] = [];

  if (profile.maxDailyLossPct && profile.accountEquity) {
    const lossPct = (-todaysPnl(trades, now) / profile.accountEquity) * 100;
    if (lossPct >= profile.maxDailyLossPct) {
      breaches.push({ rule: "daily-loss", severity: "critical", message: `Today's loss (${lossPct.toFixed(1)}%) has hit your ${profile.maxDailyLossPct}% daily limit.` });
    }
  }

  if (profile.maxWeeklyDrawdownPct && profile.accountEquity) {
    const lossPct = (-weeklyPnl(trades, now) / profile.accountEquity) * 100;
    if (lossPct >= profile.maxWeeklyDrawdownPct) {
      breaches.push({ rule: "weekly-drawdown", severity: "critical", message: `This week's drawdown (${lossPct.toFixed(1)}%) has hit your ${profile.maxWeeklyDrawdownPct}% weekly limit.` });
    }
  }

  if (profile.maxTradesPerDay) {
    const count = tradesOpenedToday(trades, now);
    if (count > profile.maxTradesPerDay) {
      breaches.push({ rule: "overtrading", severity: "warn", message: `${count} trades opened today, over your ${profile.maxTradesPerDay}/day limit.` });
    }
  }

  const correlated = correlatedExposure(trades);
  for (const symbol of correlated) {
    breaches.push({ rule: "correlated-exposure", severity: "warn", message: `Multiple open positions on ${symbol}.` });
  }

  const highLev = highLeverageTrades(trades, profile.maxLeverage ?? 10);
  for (const t of highLev) {
    breaches.push({ rule: "leverage", severity: "warn", message: `${t.symbol} is open at ${t.leverage}x leverage.` });
  }

  if (profile.revengeCooldownMinutes) {
    const openTrades: RiskTrade[] = [];
    const priorLosses: { id: string; exitTime: number }[] = [];
    for (const t of trades) {
      if (deriveStatus(t.fills) === "open") {
        openTrades.push(t);
      } else if (realizedPnl(t.side, t.fills) < 0) {
        const exitAt = lastExitAt(t.fills);
        if (exitAt) {
          priorLosses.push({ id: t.id, exitTime: new Date(exitAt).getTime() });
        }
      }
    }
    const maxGapMs = profile.revengeCooldownMinutes * 60_000;
    for (const t of openTrades) {
      const openedAt = firstEntryAt(t.fills);
      if (!openedAt) continue;
      const openedTime = new Date(openedAt).getTime();
      const isRevenge = priorLosses.some(
        (l) => l.id !== t.id && openedTime >= l.exitTime && openedTime - l.exitTime < maxGapMs
      );
      if (isRevenge) {
        breaches.push({ rule: "revenge-trade", severity: "warn", message: `${t.symbol} was opened shortly after a loss.` });
      }
    }
  }

  if (profile.maxOpenRiskPct && profile.accountEquity) {
    const openRiskUsd = trades.filter((t) => deriveStatus(t.fills) === "open").reduce((s, t) => s + plannedRiskUsd(t), 0);
    const openRiskPct = (openRiskUsd / profile.accountEquity) * 100;
    if (openRiskPct >= profile.maxOpenRiskPct) {
      breaches.push({ rule: "open-risk", severity: "critical", message: `Total open risk (${openRiskPct.toFixed(1)}%) exceeds your ${profile.maxOpenRiskPct}% limit.` });
    }
  }

  return breaches;
}

/** 0-100 score: starts at 100, loses points per breach (critical costs more than warn). */
export function ruleAdherenceScore(breaches: Breach[]): number {
  const penalty = breaches.reduce((s, b) => s + (b.severity === "critical" ? 20 : 8), 0);
  return Math.max(0, 100 - penalty);
}

export type AdherencePoint = { date: string; score: number };

/** Re-runs scanBreaches/ruleAdherenceScore as-of each of the last `days` days,
 * using only trades opened on/before that day - a historical "what would my
 * score have shown" trend. Entirely derived, nothing persisted. */
export function adherenceTrend(trades: RiskTrade[], profile: RiskProfile, now: Date, days = 30): AdherencePoint[] {
  const out: AdherencePoint[] = [];
  const tradesWithDay = trades
    .map((t) => {
      const openedAt = firstEntryAt(t.fills);
      return { trade: t, dayStr: openedAt !== "" ? dayKey(openedAt) : "" };
    })
    .filter((x) => x.dayStr !== "");

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayStr = day.toISOString().slice(0, 10);
    const tradesAsOf = tradesWithDay
      .filter((x) => x.dayStr <= dayStr)
      .map((x) => x.trade);
    out.push({ date: dayStr, score: ruleAdherenceScore(scanBreaches(tradesAsOf, profile, day)) });
  }
  return out;
}

/** Inverse of plannedRiskUsd: the position size that risks exactly `riskPct`%
 * of `equity` given an entry and stop price. Null without a valid stop distance. */
export function suggestedPositionSize(
  equity: number,
  riskPct: number,
  entryPrice: number,
  stopPrice: number
): { size: number; notional: number; riskUsd: number } | null {
  const stopDistance = Math.abs(entryPrice - stopPrice);
  if (!(equity > 0) || !(riskPct > 0) || !(entryPrice > 0) || stopDistance <= 0) return null;
  const riskUsd = equity * (riskPct / 100);
  const size = riskUsd / stopDistance;
  return { size, notional: size * entryPrice, riskUsd };
}

/** Safe mode triggers after `threshold` (default 3) consecutive losses - a cue to size down / pause. */
export function safeModeActive(trades: RiskTrade[], threshold = 3): boolean {
  return currentLosingStreak(trades) >= threshold;
}
