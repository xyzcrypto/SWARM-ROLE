"use client";

import { useMemo, useState } from "react";
import { pnl, type Side } from "@/lib/calculators";
import { CalcField, CalcSegmented, ResultTile } from "./CalcField";

export function PnlCalculator() {
  const [entry, setEntry] = useState("100");
  const [exit, setExit] = useState("110");
  const [notional, setNotional] = useState("1000");
  const [fee, setFee] = useState("0.05");
  const [side, setSide] = useState<Side>("long");

  const result = useMemo(
    () =>
      pnl({
        entryPrice: Number(entry) || 0,
        exitPrice: Number(exit) || 0,
        notionalUsd: Number(notional) || 0,
        feePct: Number(fee) || 0,
        side,
      }),
    [entry, exit, notional, fee, side]
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-semibold text-zinc-50">PnL Calculator</h3>
        <p className="mt-1 text-sm text-zinc-500">Work out a trade&apos;s profit or loss before or after you take it.</p>
      </div>

      <div className="flex justify-center">
        <CalcSegmented options={[{ value: "long", label: "Long" }, { value: "short", label: "Short" }]} value={side} onChange={setSide} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CalcField label="Entry price" value={entry} onChange={setEntry} suffix="USD" />
        <CalcField label="Exit price" value={exit} onChange={setExit} suffix="USD" />
        <CalcField label="Position size" value={notional} onChange={setNotional} suffix="USD" />
        <CalcField label="Fees (both legs)" value={fee} onChange={setFee} suffix="%" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ResultTile label="Gross P&L" value={`$${result.grossPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
        <ResultTile
          label="Net P&L"
          value={`$${result.netPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          tone={result.netPnl >= 0 ? "mint" : "rose"}
        />
        <ResultTile label="ROI" value={`${result.roiPct.toFixed(2)}%`} tone={result.roiPct >= 0 ? "mint" : "rose"} />
      </div>
    </div>
  );
}
