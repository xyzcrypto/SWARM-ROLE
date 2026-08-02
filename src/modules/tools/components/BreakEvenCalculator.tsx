"use client";

import { useMemo, useState } from "react";
import { breakEvenPrice, type Side } from "@/lib/calculators";
import { CalcField, CalcSegmented, ResultTile } from "./CalcField";

export function BreakEvenCalculator() {
  const [entry, setEntry] = useState("100");
  const [fee, setFee] = useState("0.05");
  const [side, setSide] = useState<Side>("long");

  const result = useMemo(
    () => breakEvenPrice({ entryPrice: Number(entry) || 0, side, feePct: Number(fee) || 0 }),
    [entry, fee, side]
  );
  const movePct = Number(entry) > 0 ? (Math.abs(result - Number(entry)) / Number(entry)) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-semibold text-zinc-50">Break-Even Calculator</h3>
        <p className="mt-1 text-sm text-zinc-500">The exit price where round-trip fees exactly cancel out your P&amp;L.</p>
      </div>

      <div className="flex justify-center">
        <CalcSegmented options={[{ value: "long", label: "Long" }, { value: "short", label: "Short" }]} value={side} onChange={setSide} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CalcField label="Entry price" value={entry} onChange={setEntry} suffix="USD" />
        <CalcField label="Fee (per leg)" value={fee} onChange={setFee} suffix="%" hint="Maker/taker fee, charged on entry and exit." />
      </div>

      <ResultTile
        label="Break-even price"
        value={`$${result.toLocaleString(undefined, { maximumFractionDigits: 4 })}`}
        tone="gold"
        hint={`${movePct.toFixed(3)}% away from entry`}
      />
    </div>
  );
}
