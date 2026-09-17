"use client";

import { cn } from "@/lib/utils";
import { CalcField, ResultTile } from "@modules/tools/components/CalcField";
import { usdCompact, type BreakEven, type CostResult, type ValueResult } from "@modules/points/lib/points";

/**
 * The half of the trade nobody models.
 *
 * Farmers track points obsessively and their cost basis not at all, which is
 * how a program paying 0.02% of volume gets farmed with 0.04% taker fees - a
 * guaranteed loss, invisible from the points total alone.
 */
export function CostPanel({
  form,
  set,
  cost,
  be,
  eff,
  value,
}: {
  form: any;
  set: (k: any, v: any) => void;
  cost: CostResult;
  be: BreakEven;
  eff: { costPerPoint: number; pointsPer1kVolume: number };
  value: ValueResult;
}) {
  const profitable = be.netUsd >= 0 && !be.unreachable;

  return (
    <section className="surface rounded-3xl p-5 sm:p-8">
      <h2 className="font-display text-xl font-semibold tracking-tight text-content sm:text-2xl">
        What this farm has <span className="text-shine">cost you</span>
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-content-muted">
        Fees are asked for as volume x rate rather than a round total, because the fee line is usually what decides
        whether a farm was worth doing, and almost nobody adds it up.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CalcField
          label="Volume traded"
          value={form.volumeUsd}
          onChange={(v) => set("volumeUsd", v)}
          suffix="USD"
          hint={`Fees: ${usdCompact(cost.feesUsd)}`}
        />
        <CalcField
          label="Effective fee rate"
          value={form.feeRatePct}
          onChange={(v) => set("feeRatePct", v)}
          suffix="%"
          hint="Round trip, after any rebate"
        />
        <CalcField label="Gas and bridging" value={form.gasUsd} onChange={(v) => set("gasUsd", v)} suffix="USD" />
        <CalcField
          label="Capital parked"
          value={form.capitalUsd}
          onChange={(v) => set("capitalUsd", v)}
          suffix="USD"
        />
        <CalcField label="Days farming" value={form.days} onChange={(v) => set("days", v)} />
        <CalcField
          label="Yield given up"
          value={form.aprPct}
          onChange={(v) => set("aprPct", v)}
          suffix="% APR"
          hint={`Opportunity cost: ${usdCompact(cost.opportunityUsd)}`}
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ResultTile
          label="Out of pocket"
          value={usdCompact(cost.cashCostUsd)}
          hint="Fees and gas - what actually left your wallet"
        />
        <ResultTile
          label="True cost"
          value={usdCompact(cost.totalCostUsd)}
          hint="Including the yield that capital gave up"
        />
        <ResultTile
          label={profitable ? "Net, at this FDV" : "Net loss, at this FDV"}
          value={usdCompact(be.netUsd)}
          tone={profitable ? "mint" : "rose"}
          hint={
            be.unreachable
              ? "No points means no tokens at any valuation"
              : `${be.roiMultiple.toFixed(2)}x on true cost`
          }
        />
      </div>

      {/* The one number a farmer should actually carry around. */}
      <div
        className={cn(
          "mt-6 rounded-2xl border p-5 sm:p-6",
          be.unreachable
            ? "border-rose-500/25 bg-rose-500/[0.06]"
            : "border-hairline bg-surface-2"
        )}
      >
        {be.unreachable ? (
          <p className="text-sm text-rose-200">
            This position cannot break even at any valuation — with no points there are no tokens to be worth
            anything. The cost is already sunk.
          </p>
        ) : (
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className="text-xs text-content-subtle">Break-even FDV</p>
              <p className="mt-1.5 mono text-3xl font-semibold sm:text-4xl">
                <span className={profitable ? "text-mint-gradient" : "text-gold-gradient"}>
                  {usdCompact(be.fdvUsd)}
                </span>
              </p>
              <p className="mt-1 text-[11px] text-content-subtle">
                Below this, the farm lost money. Value scales linearly with FDV, so this is exact, not a search.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-right text-xs">
              <dt className="text-content-subtle">Cost per point</dt>
              <dd className="mono text-content">
                ${eff.costPerPoint.toLocaleString("en-US", { maximumFractionDigits: 4 })}
              </dd>
              <dt className="text-content-subtle">Points per $1k volume</dt>
              <dd className="mono text-content">
                {eff.pointsPer1kVolume.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </dd>
              <dt className="text-content-subtle">Value per point</dt>
              <dd className="mono text-content">
                $
                {(Number(form.yourPoints) > 0
                  ? value.grossUsd / Number(form.yourPoints)
                  : 0
                ).toLocaleString("en-US", { maximumFractionDigits: 4 })}
              </dd>
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}
