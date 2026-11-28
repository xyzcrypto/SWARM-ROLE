"use client";

import { useMemo, useState } from "react";
import { Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPlatform } from "@/lib/dex-registry";
import { equityCurve } from "@/lib/journal";
import {
  avgHoldTimeHours,
  bestWorst,
  drawdownCurve,
  earlyExitRate,
  expectancy,
  grossPnl,
  groupBy,
  longVsShort,
  maxDrawdown,
  mistakeFrequency,
  periodBreakdown,
  profitFactor,
  realizedRMultiples,
  type AnalyzableTrade,
} from "@/lib/journal-analytics";
import { EquityCurveChart } from "./EquityCurveChart";
import { CalendarHeatmap } from "./CalendarHeatmap";
import { PremiumGate } from "./PremiumGate";
import type { SerializedTrade } from "./JournalClient";

function StatTile({ label, value, tone = "plain", hint }: { label: string; value: string; tone?: "plain" | "mint" | "gold" | "rose"; hint?: string }) {
  const num = tone === "mint" ? "text-mint-gradient" : tone === "gold" ? "text-gold-gradient" : tone === "rose" ? "text-rose-400" : "text-zinc-50";
  return (
    <div className="surface surface-hover lift rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={cn("mt-2 mono text-2xl font-semibold", num)}>{value}</p>
      {hint && <p className="mt-1 text-[0.6875rem] text-zinc-600">{hint}</p>}
    </div>
  );
}

function money(n: number): string {
  return `${n >= 0 ? "" : "-"}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function BreakdownTable({ title, groups, labelFor }: { title: string; groups: ReturnType<typeof groupBy>; labelFor?: (key: string) => string }) {
  const { best, worst } = bestWorst(groups);
  if (groups.length === 0) {
    return (
      <div className="surface rounded-2xl p-5">
        <h3 className="mb-3 text-sm font-semibold text-zinc-200">{title}</h3>
        <p className="text-xs text-zinc-600">Not enough closed trades yet.</p>
      </div>
    );
  }
  return (
    <div className="surface rounded-2xl p-5">
      <h3 className="mb-3 text-sm font-semibold text-zinc-200">{title}</h3>
      <div className="space-y-2 text-xs">
        {best && (
          <div className="flex items-center justify-between rounded-lg bg-mint-500/[0.06] px-3 py-2">
            <span className="text-zinc-300">Best: {labelFor ? labelFor(best.key) : best.key}</span>
            <span className="mono text-mint-300">{money(best.totalPnl)}</span>
          </div>
        )}
        {worst && worst.key !== best?.key && (
          <div className="flex items-center justify-between rounded-lg bg-rose-500/[0.06] px-3 py-2">
            <span className="text-zinc-300">Worst: {labelFor ? labelFor(worst.key) : worst.key}</span>
            <span className="mono text-rose-300">{money(worst.totalPnl)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const GRANULARITIES = [
  { value: "day" as const, label: "Daily" },
  { value: "week" as const, label: "Weekly" },
  { value: "month" as const, label: "Monthly" },
];

export function AnalyticsPanel({ trades, isPremium, userId }: { trades: SerializedTrade[]; isPremium: boolean; userId: string }) {
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("week");

  const analyzable: AnalyzableTrade[] = useMemo(
    () =>
      trades.map((t) => ({
        side: t.side,
        fills: t.fills,
        stopLoss: t.stopLoss,
        takeProfit: t.takeProfit,
        symbol: t.symbol,
        setup: t.setup,
        session: t.session,
        platformId: t.platformId,
        mistakes: t.mistakes,
      })),
    [trades]
  );

  const curve = useMemo(() => equityCurve(trades.map((t) => ({ side: t.side, fills: t.fills }))), [trades]);
  const ddCurve = useMemo(() => drawdownCurve(curve), [curve]);
  const rMultiples = useMemo(() => realizedRMultiples(analyzable), [analyzable]);
  const periods = useMemo(() => periodBreakdown(analyzable, granularity), [analyzable, granularity]);
  const dayBuckets = useMemo(() => periodBreakdown(analyzable, "day"), [analyzable]);
  const bySetup = useMemo(() => groupBy(analyzable, (t) => t.setup), [analyzable]);
  const byAsset = useMemo(() => groupBy(analyzable, (t) => t.symbol), [analyzable]);
  const byPlatform = useMemo(() => groupBy(analyzable, (t) => t.platformId), [analyzable]);
  const bySession = useMemo(() => groupBy(analyzable, (t) => t.session), [analyzable]);
  const sides = useMemo(() => longVsShort(analyzable), [analyzable]);
  const mistakes = useMemo(() => mistakeFrequency(analyzable), [analyzable]);

  const gross = analyzable.reduce((s, t) => s + grossPnl(t), 0);
  const pf = profitFactor(analyzable);
  const exp = expectancy(analyzable);
  const dd = maxDrawdown(curve);
  const avgR = rMultiples.length ? rMultiples.reduce((s, r) => s + r, 0) / rMultiples.length : null;
  const holdHours = avgHoldTimeHours(analyzable);
  const earlyRate = earlyExitRate(analyzable);

  if (trades.length === 0) {
    return (
      <div className="surface rounded-2xl p-8 text-center text-sm text-zinc-500">
        Log and close a few trades to unlock analytics.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <a
          href={`/api/journal/share/overview/${userId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary inline-flex items-center gap-1.5 text-xs"
        >
          <Share2 className="h-3.5 w-3.5" /> Share my stats
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Gross P&L" value={money(gross)} tone={gross >= 0 ? "mint" : "rose"} />
        <StatTile label="Profit factor" value={pf != null ? pf.toFixed(2) : "-"} tone="gold" hint="Gross profit ÷ gross loss" />
        <StatTile label="Expectancy" value={money(exp)} tone={exp >= 0 ? "mint" : "rose"} hint="Avg P&L per closed trade" />
        <StatTile label="Max drawdown" value={money(-dd)} tone="rose" />
        <StatTile label="Avg realized R" value={avgR != null ? avgR.toFixed(2) : "-"} tone="gold" />
        <StatTile label="Avg hold time" value={holdHours != null ? `${holdHours.toFixed(1)}h` : "-"} />
        <StatTile label="Early exit rate" value={`${earlyRate.toFixed(0)}%`} hint="Closed before hitting take-profit" />
        <StatTile label="Long vs short" value={`${sides[0].trades} / ${sides[1].trades}`} hint={`${money(sides[0].totalPnl)} / ${money(sides[1].totalPnl)}`} />
      </div>

      <div className="relative">
        <div aria-hidden={!isPremium} className={cn("space-y-8", !isPremium && "pointer-events-none select-none blur-[6px] opacity-70")}>
          <div className="surface rounded-3xl p-6 sm:p-7">
            <h2 className="mb-4 font-display text-base font-semibold text-zinc-200">Drawdown</h2>
            <EquityCurveChart points={ddCurve} emptyLabel="No closed trades yet." captionLabel="Drawdown from peak over time" />
          </div>

          <div className="surface rounded-3xl p-6 sm:p-7">
            <h2 className="mb-4 font-display text-base font-semibold text-zinc-200">Activity heatmap</h2>
            <CalendarHeatmap dayBuckets={dayBuckets} />
          </div>

          <div className="surface rounded-3xl p-6 sm:p-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-zinc-200">P&amp;L breakdown</h2>
              <div className="inline-flex rounded-xl border border-white/10 bg-ink-950/50 p-1">
                {GRANULARITIES.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setGranularity(g.value)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      granularity === g.value ? "bg-gold-500/15 text-gold-100 ring-1 ring-gold-500/30" : "text-zinc-400 hover:text-zinc-100"
                    )}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
            {periods.length === 0 ? (
              <p className="text-xs text-zinc-600">No closed trades yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-zinc-600">
                      <th className="pb-1.5 pr-4 font-medium">Period</th>
                      <th className="pb-1.5 pr-4 font-medium">Trades</th>
                      <th className="pb-1.5 font-medium">P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300">
                    {[...periods].reverse().map((p) => (
                      <tr key={p.period} className="border-t border-line/50">
                        <td className="py-1.5 pr-4 mono">{p.period}</td>
                        <td className="py-1.5 pr-4 mono">{p.trades}</td>
                        <td className={cn("py-1.5 mono", p.pnl >= 0 ? "text-mint-300" : "text-rose-300")}>{money(p.pnl)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <BreakdownTable title="By setup" groups={bySetup} />
            <BreakdownTable title="By asset" groups={byAsset} />
            <BreakdownTable title="By platform" groups={byPlatform} labelFor={(id) => getPlatform(id)?.name ?? id} />
            <BreakdownTable title="By session" groups={bySession} />
          </div>

          {mistakes.length > 0 && (
            <div className="surface rounded-3xl p-6 sm:p-7">
              <h2 className="mb-4 font-display text-base font-semibold text-zinc-200">Mistake patterns</h2>
              <div className="flex flex-wrap gap-2">
                {mistakes.map((m) => (
                  <span key={m.mistake} className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/25 bg-rose-500/[0.06] px-3 py-1 text-xs text-rose-200">
                    {m.mistake}
                    <span className="mono text-rose-400">×{m.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {!isPremium && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-b from-ink-950/10 via-ink-950/40 to-ink-950/70 p-4">
            <PremiumGate
              title="Unlock deep analytics"
              perks={["Drawdown curve + activity heatmap", "Daily/weekly/monthly P&L breakdown", "Best/worst by setup, asset, platform, session", "Mistake-pattern tracking"]}
              loggedIn
            />
          </div>
        )}
      </div>
    </div>
  );
}
