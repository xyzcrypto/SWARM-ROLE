"use client";

import { useMemo, useState } from "react";
import { drawdownRecoveryPct } from "@/lib/calculators";
import { AssumptionBanner, CalcField, ResultTile } from "./CalcField";

export function DrawdownRecoveryCalculator() {
  const [drawdown, setDrawdown] = useState("20");

  const recovery = useMemo(() => drawdownRecoveryPct(Number(drawdown) || 0), [drawdown]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-semibold text-zinc-50">Drawdown Recovery Calculator</h3>
        <p className="mt-1 text-sm text-zinc-500">Losses and gains aren&apos;t symmetric - see the real gain needed to get back to even.</p>
      </div>

      <AssumptionBanner>A 50% loss needs a 100% gain to fully recover - the bigger the drawdown, the steeper the climb back.</AssumptionBanner>

      <CalcField label="Drawdown" value={drawdown} onChange={setDrawdown} suffix="%" hint="How much your account is down from its peak." />

      <ResultTile
        label="Gain needed to recover"
        value={Number.isFinite(recovery) ? `${recovery.toFixed(1)}%` : "∞"}
        tone="rose"
      />
    </div>
  );
}
