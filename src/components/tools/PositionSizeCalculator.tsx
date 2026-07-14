"use client";

import { useMemo, useState } from "react";
import { positionSize, riskReward } from "@/lib/calculators";
import { CalcField, ResultTile } from "./CalcField";

export function PositionSizeCalculator() {
  const [equity, setEquity] = useState("10000");
  const [riskPct, setRiskPct] = useState("1");
  const [entry, setEntry] = useState("100");
  const [stop, setStop] = useState("95");
  const [target, setTarget] = useState("115");

  const size = useMemo(
    () =>
      positionSize({
        equityUsd: Number(equity) || 0,
        riskPct: Number(riskPct) || 0,
        entryPrice: Number(entry) || 0,
        stopPrice: Number(stop) || 0,
      }),
    [equity, riskPct, entry, stop]
  );
  const rr = useMemo(
    () => riskReward({ entryPrice: Number(entry) || 0, stopPrice: Number(stop) || 0, targetPrice: Number(target) || 0 }),
    [entry, stop, target]
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-semibold text-zinc-50">Position Size &amp; Risk:Reward Calculator</h3>
        <p className="mt-1 text-sm text-zinc-500">Size a trade from your risk tolerance, not a guess.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CalcField label="Account equity" value={equity} onChange={setEquity} suffix="USD" />
        <CalcField label="Risk per trade" value={riskPct} onChange={setRiskPct} suffix="%" />
        <CalcField label="Entry price" value={entry} onChange={setEntry} suffix="USD" />
        <CalcField label="Stop loss" value={stop} onChange={setStop} suffix="USD" />
        <CalcField label="Take profit" value={target} onChange={setTarget} suffix="USD" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ResultTile label="Risk amount" value={`$${size.riskUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} tone="rose" />
        <ResultTile label="Position size" value={`$${size.notionalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
        <ResultTile label="Leverage needed" value={`${size.leverageNeeded.toFixed(2)}x`} />
        <ResultTile label="Risk:Reward" value={`1 : ${rr.toFixed(2)}`} tone="mint" />
      </div>
    </div>
  );
}
