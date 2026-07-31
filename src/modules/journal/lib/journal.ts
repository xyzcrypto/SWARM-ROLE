// Pure Trading Journal math: derives everything (average entry price, open
// size, realized P&L, status) from a trade's fills - nothing is stored
// redundantly. No React, no Prisma types - plain data in, plain data out, so
// this is reusable server-side (API routes) and client-side (JournalClient)
// identically, and unit-testable in isolation.

export type Side = "long" | "short";
export type Fill = { kind: "entry" | "exit"; price: number; size: number; fee: number };

export type TradeLike = {
  side: string;
  fills: Fill[];
  stopLoss?: number | null;
  takeProfit?: number | null;
};

function sumSize(fills: Fill[], kind: "entry" | "exit"): number {
  return fills.filter((f) => f.kind === kind).reduce((s, f) => s + f.size, 0);
}

/** Size-weighted average price across a set of fills (0 if none). */
export function weightedAvgPrice(fills: Fill[], kind: "entry" | "exit"): number {
  const set = fills.filter((f) => f.kind === kind);
  const size = set.reduce((s, f) => s + f.size, 0);
  if (size === 0) return 0;
  return set.reduce((s, f) => s + f.price * f.size, 0) / size;
}

export function totalFees(fills: Fill[]): number {
  return fills.reduce((s, f) => s + f.fee, 0);
}

export function entrySize(fills: Fill[]): number {
  return sumSize(fills, "entry");
}

export function exitSize(fills: Fill[]): number {
  return sumSize(fills, "exit");
}

/** Remaining open size (entry size not yet exited). Never negative. */
export function openSize(fills: Fill[]): number {
  return Math.max(0, entrySize(fills) - exitSize(fills));
}

/**
 * Realized P&L using the average-cost method: every exit fill is priced
 * against the trade's overall average entry price. Net of fees. Returns 0
 * when there are no exits yet (an open trade has no realized P&L).
 */
export function realizedPnl(side: string, fills: Fill[]): number {
  const avgEntry = weightedAvgPrice(fills, "entry");
  const direction = side === "long" ? 1 : -1;
  const exitFills = fills.filter((f) => f.kind === "exit");
  const gross = exitFills.reduce((s, f) => s + (f.price - avgEntry) * f.size * direction, 0);
  return gross - totalFees(fills);
}

/** Derives a trade's status from its fills - "closed" once fully exited. */
export function deriveStatus(fills: Fill[]): "open" | "closed" | "partial" {
  const entry = entrySize(fills);
  const exit = exitSize(fills);
  if (entry === 0 || exit === 0) return "open";
  if (exit >= entry) return "closed";
  return "partial";
}

export type JournalStats = {
  totalTrades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgR: number | null;
};

/** Aggregate stats across a list of trades (closed trades only count toward win rate/P&L). */
export function computeStats(trades: TradeLike[]): JournalStats {
  const closed = trades.filter((t) => deriveStatus(t.fills) !== "open");
  const pnls = closed.map((t) => realizedPnl(t.side, t.fills));
  const wins = pnls.filter((p) => p > 0).length;
  const losses = pnls.filter((p) => p < 0).length;
  const totalPnl = pnls.reduce((s, p) => s + p, 0);
  const rValues = trades.map((t) => riskReward(t)).filter((r): r is number => r !== null);
  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    wins,
    losses,
    winRate: closed.length > 0 ? (wins / closed.length) * 100 : 0,
    totalPnl,
    avgR: rValues.length > 0 ? rValues.reduce((s, r) => s + r, 0) / rValues.length : null,
  };
}

/** Planned R-multiple from a trade's stop/target vs. its average entry - null if either is unset. */
export function riskReward(t: TradeLike): number | null {
  if (t.stopLoss == null || t.takeProfit == null) return null;
  const entry = weightedAvgPrice(t.fills, "entry");
  if (entry === 0) return null;
  const risk = Math.abs(entry - t.stopLoss);
  const reward = Math.abs(t.takeProfit - entry);
  return risk > 0 ? reward / risk : null;
}

export type EquityPoint = { date: string; cumPnl: number };
export type FillWithTime = Fill & { executedAt: string };
export type TradeWithTimedFills = { side: string; fills: FillWithTime[] };

/** Cumulative realized P&L over time, one point per closed/partial trade's last exit. */
export function equityCurve(trades: TradeWithTimedFills[]): EquityPoint[] {
  const events = trades
    .filter((t) => deriveStatus(t.fills) !== "open")
    .map((t) => {
      const exits = t.fills.filter((f) => f.kind === "exit");
      const lastExit = exits.reduce((latest, f) => (f.executedAt > latest ? f.executedAt : latest), exits[0]?.executedAt ?? "");
      return { date: lastExit, pnl: realizedPnl(t.side, t.fills) };
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  let cum = 0;
  return events.map((e) => {
    cum += e.pnl;
    return { date: e.date, cumPnl: cum };
  });
}
