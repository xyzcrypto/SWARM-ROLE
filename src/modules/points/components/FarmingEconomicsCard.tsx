"use client";

import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, DollarSign, Layers, Scale, TrendingUp } from "lucide-react";
import { usdCompact, type BreakEven, type CostResult, type ValueResult } from "@modules/points/lib/points";

interface FarmingEconomicsCardProps {
  cost: CostResult;
  value: ValueResult;
  be: BreakEven | null;
}

export function FarmingEconomicsCard({ cost, value, be }: FarmingEconomicsCardProps) {
  // Calculations
  const economics = useMemo(() => {
    const totalCost = cost.totalCostUsd || 1;
    const grossVal = value.grossUsd;
    const netProfit = grossVal - totalCost;
    const roiPct = ((grossVal - totalCost) / totalCost) * 100;
    const beFdv = be && be.fdvUsd > 0 ? usdCompact(be.fdvUsd) : "—";

    // Cost Breakdown %
    const feePct = Math.round((cost.feesUsd / totalCost) * 100) || 0;
    const gasPct = Math.round((cost.gasUsd / totalCost) * 100) || 0;
    const oppPct = Math.max(0, 100 - feePct - gasPct);

    return {
      totalCost,
      grossVal,
      netProfit,
      roiPct,
      beFdv,
      feePct,
      gasPct,
      oppPct,
    };
  }, [cost, value, be]);

  const isProfitable = economics.netProfit >= 0;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-hairline bg-surface-2 p-5 sm:p-6">
      {/* Header */}
      <div className="pb-4 border-b border-hairline">
        <h2 className="font-display text-lg font-bold tracking-tight text-content sm:text-xl">
          Farming Economics
        </h2>
        <p className="text-xs text-content-muted">
          Understand your costs and potential returns
        </p>
      </div>

      {/* 4 Metric Tiles (2x2) */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        {/* Total Cost */}
        <div className="rounded-xl border border-hairline bg-base p-3.5">
          <div className="flex items-center gap-2 text-content-subtle">
            <span className="grid h-5 w-5 place-items-center rounded bg-amber-500/10 text-amber-300">
              <Layers className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-medium">Total Cost</span>
          </div>
          <div className="mono mt-2 font-display text-xl font-bold text-content">
            {usdCompact(economics.totalCost)}
          </div>
        </div>

        {/* Total Value */}
        <div className="rounded-xl border border-hairline bg-base p-3.5">
          <div className="flex items-center gap-2 text-content-subtle">
            <span className="grid h-5 w-5 place-items-center rounded bg-gold-500/10 text-gold-300">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-medium">Total Value</span>
          </div>
          <div className="mono mt-2 font-display text-xl font-bold text-gold-200">
            {usdCompact(economics.grossVal)}
          </div>
        </div>

        {/* Net ROI */}
        <div className="rounded-xl border border-hairline bg-base p-3.5">
          <div className="flex items-center gap-2 text-content-subtle">
            <span
              className={`grid h-5 w-5 place-items-center rounded ${
                isProfitable ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"
              }`}
            >
              {isProfitable ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
            </span>
            <span className="text-xs font-medium">Net ROI</span>
          </div>
          <div
            className={`mono mt-2 font-display text-xl font-bold ${
              isProfitable ? "grid-net-up" : "grid-net-down"
            }`}
          >
            {economics.roiPct > 0 ? "+" : ""}
            {economics.roiPct.toFixed(1)}%
          </div>
        </div>

        {/* Break-even FDV */}
        <div className="rounded-xl border border-hairline bg-base p-3.5">
          <div className="flex items-center gap-2 text-content-subtle">
            <span className="grid h-5 w-5 place-items-center rounded bg-gold-500/10 text-gold-300">
              <Scale className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-medium">Break-even FDV</span>
          </div>
          <div className="mono mt-2 font-display text-xl font-bold text-content">
            {economics.beFdv}
          </div>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="mt-6 pt-4 border-t border-hairline">
        <div className="text-xs font-semibold text-content-muted mb-2.5">
          Cost Breakdown
        </div>

        {/* Multi-color segmented progress bar */}
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-base">
          <div
            style={{ width: `${economics.feePct}%` }}
            className="bg-amber-400 transition-all duration-500"
            title={`Trading Fees: ${economics.feePct}%`}
          />
          <div
            style={{ width: `${economics.gasPct}%` }}
            className="bg-purple-500 transition-all duration-500"
            title={`Gas Fees: ${economics.gasPct}%`}
          />
          <div
            style={{ width: `${economics.oppPct}%` }}
            className="bg-sky-500 transition-all duration-500"
            title={`Opportunity Cost: ${economics.oppPct}%`}
          />
        </div>

        {/* Rows */}
        <div className="mt-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-content-muted">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span>Trading Fees</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="mono font-semibold text-content">{usdCompact(cost.feesUsd)}</span>
              <span className="mono text-content-subtle w-8 text-right">{economics.feePct}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-content-muted">
              <span className="h-2 w-2 rounded-full bg-purple-500" />
              <span>Gas Fees</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="mono font-semibold text-content">{usdCompact(cost.gasUsd)}</span>
              <span className="mono text-content-subtle w-8 text-right">{economics.gasPct}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-content-muted">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              <span>Opportunity Cost</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="mono font-semibold text-content">{usdCompact(cost.opportunityUsd)}</span>
              <span className="mono text-content-subtle w-8 text-right">{economics.oppPct}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
