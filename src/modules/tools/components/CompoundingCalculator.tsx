"use client";

import { useMemo, useState } from "react";
import { compoundGrowth } from "@/lib/calculators";
import { CalcField, ResultTile } from "./CalcField";

const PRESETS = [
  { label: "Daily × 30", periods: 30 },
  { label: "Weekly × 12", periods: 12 },
  { label: "Monthly × 12", periods: 12 },
] as const;

export function CompoundingCalculator() {
  const [capital, setCapital] = useState("10000");
  const [returnPct, setReturnPct] = useState("2");
  const [periods, setPeriods] = useState("30");

  const result = useMemo(
    () =>
      compoundGrowth({
        startingCapital: Number(capital) || 0,
        returnPctPerPeriod: Number(returnPct) || 0,
        periods: Number(periods) || 0,
      }),
    [capital, returnPct, periods]
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-semibold text-zinc-50">Compounding Calculator</h3>
        <p className="mt-1 text-sm text-zinc-500">Project capital growth from a fixed return per period - see how compounding adds up.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CalcField label="Starting capital" value={capital} onChange={setCapital} suffix="USD" />
        <CalcField label="Return per period" value={returnPct} onChange={setReturnPct} suffix="%" />
        <CalcField label="Number of periods" value={periods} onChange={setPeriods} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setPeriods(String(p.periods))}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-gold-500/40 hover:text-gold-200"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ResultTile label="Final capital" value={`$${result.finalCapital.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} tone="mint" />
        <ResultTile label="Total gain" value={`$${result.totalGain.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
        <ResultTile label="Total return" value={`${result.totalReturnPct.toFixed(1)}%`} tone="gold" />
      </div>
    </div>
  );
}
