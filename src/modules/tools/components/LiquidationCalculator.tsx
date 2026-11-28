"use client";

import { useMemo, useState } from "react";
import { liquidationPrice, type Side } from "@/lib/calculators";
import { AssumptionBanner, CalcField, CalcSegmented, ResultTile } from "./CalcField";

export function LiquidationCalculator() {
  const [entry, setEntry] = useState("100");
  const [leverage, setLeverage] = useState("10");
  const [mmr, setMmr] = useState("0.5");
  const [side, setSide] = useState<Side>("long");

  const liq = useMemo(
    () =>
      liquidationPrice({
        entryPrice: Number(entry) || 0,
        leverage: Number(leverage) || 1,
        mmrPct: Number(mmr) || 0,
        side,
      }),
    [entry, leverage, mmr, side]
  );
  const distancePct = Number(entry) > 0 ? (Math.abs(liq - Number(entry)) / Number(entry)) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-semibold text-zinc-50">Liquidation Price Calculator</h3>
        <p className="mt-1 text-sm text-zinc-500">Estimate the price that would liquidate an isolated-margin position.</p>
      </div>
      <AssumptionBanner>
        Simplified isolated-margin estimate - ignores cross-margin and funding accrual. Real liquidation math
        varies by exchange; use this for planning, not as an exact figure.
      </AssumptionBanner>

      <div className="flex justify-center">
        <CalcSegmented options={[{ value: "long", label: "Long" }, { value: "short", label: "Short" }]} value={side} onChange={setSide} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CalcField label="Entry price" value={entry} onChange={setEntry} suffix="USD" />
        <CalcField label="Leverage" value={leverage} onChange={setLeverage} suffix="x" min="1" />
        <CalcField label="Maintenance margin" value={mmr} onChange={setMmr} suffix="%" hint="Editable - check your exchange's schedule." />
      </div>

      <ResultTile
        label="Estimated liquidation price"
        value={`$${liq.toLocaleString(undefined, { maximumFractionDigits: 4 })}`}
        tone="rose"
        hint={`${distancePct.toFixed(2)}% away from your entry price`}
      />
    </div>
  );
}
