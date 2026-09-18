"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Info } from "lucide-react";
import { platformLogo } from "@/lib/dex-registry";
import { cn } from "@/lib/utils";
import { usdCompact, type CompRange, type ValueResult } from "@modules/points/lib/points";
import type { ProgramView } from "@modules/points/lib/programs";

interface PointsCalculatorCardProps {
  program: ProgramView;
  programs: ProgramView[];
  onSelectProgram: (id: string) => void;
  yourPoints: string;
  onYourPointsChange: (v: string) => void;
  totalPoints: string;
  onTotalPointsChange: (v: string) => void;
  allocPct: string;
  onAllocPctChange: (v: string) => void;
  fdv: string;
  onFdvChange: (v: string) => void;
  value: ValueResult;
  range?: CompRange;
}

const ALLOC_PILLS = ["10", "20", "30", "50", "100"];
const FDV_PRESETS = [
  { label: "$100M", value: "100000000" },
  { label: "$300M", value: "300000000" },
  { label: "$500M", value: "500000000" },
  { label: "$1B", value: "1000000000" },
  { label: "$3B", value: "3000000000" },
];

export function PointsCalculatorCard({
  program,
  programs,
  onSelectProgram,
  yourPoints,
  onYourPointsChange,
  totalPoints,
  onTotalPointsChange,
  allocPct,
  onAllocPctChange,
  fdv,
  onFdvChange,
  value,
  range,
}: PointsCalculatorCardProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const logo = platformLogo({ links: program.links, logo: program.logo ?? undefined });

  // Estimated range: either from peer comps range (if available) or conservative/optimistic band
  const estRange = useMemo(() => {
    if (range && range.low > 0 && range.high > 0) {
      const lowGross = (value.grossUsd * range.low) / (range.median || 1);
      const highGross = (value.grossUsd * range.high) / (range.median || 1);
      return {
        low: Math.round(lowGross),
        high: Math.round(highGross),
      };
    }
    // Fallback spread: 0.6x to 1.6x of gross value
    return {
      low: Math.round(value.grossUsd * 0.6),
      high: Math.round(value.grossUsd * 1.6),
    };
  }, [range, value.grossUsd]);

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-hairline bg-surface-2 p-5 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-hairline">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-content sm:text-xl">
            Points Calculator
          </h2>
          <p className="text-xs text-content-muted">
            Adjust the parameters to estimate your potential airdrop value
          </p>
        </div>

        {/* Top Right: Protocol Dropdown + Confirmed Badge */}
        <div className="flex items-center gap-2">
          {/* Protocol Picker Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-xl border border-hairline bg-base px-3 py-1.5 text-xs font-semibold text-content hover:border-gold-500/30 transition-all"
            >
              {logo && <img src={logo} alt="" className="h-4 w-4 rounded-full" />}
              <span>{program.name}</span>
              <ChevronDown className="h-3.5 w-3.5 text-content-subtle" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-1 z-30 w-44 rounded-xl border border-hairline bg-surface-2 p-1 shadow-2xl backdrop-blur-xl">
                {programs.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelectProgram(p.id);
                      setDropdownOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
                      p.id === program.id
                        ? "bg-gold-500/10 text-gold-300 font-semibold"
                        : "text-content-muted hover:bg-white/5 hover:text-content"
                    )}
                  >
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Confirmed Data Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300">
            <CheckCircle2 className="h-3 w-3" />
            <span>Confirmed Data</span>
          </div>
        </div>
      </div>

      {/* Main Content: Split 2 Columns */}
      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Sub-Column: Inputs (5 cols on lg) */}
        <div className="space-y-4 lg:col-span-6">
          {/* Your Points */}
          <div>
            <label className="block text-xs font-semibold text-content-muted mb-1.5">
              Your Points
            </label>
            <input
              type="text"
              value={yourPoints}
              onChange={(e) => onYourPointsChange(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 250,000"
              className="w-full rounded-xl border border-hairline bg-base px-3.5 py-2.5 text-sm font-semibold text-content outline-none focus:border-gold-500/60 transition-colors"
            />
          </div>

          {/* Total Points */}
          <div>
            <label className="block text-xs font-semibold text-content-muted mb-1.5">
              Total Points
            </label>
            <input
              type="text"
              value={totalPoints}
              onChange={(e) => onTotalPointsChange(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 72,000,000"
              className="w-full rounded-xl border border-hairline bg-base px-3.5 py-2.5 text-sm font-semibold text-content outline-none focus:border-gold-500/60 transition-colors"
            />
          </div>

          {/* Allocation % Buttons */}
          <div>
            <label className="block text-xs font-semibold text-content-muted mb-1.5">
              Allocation %
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {ALLOC_PILLS.map((pill) => {
                const isActive = allocPct === pill;
                return (
                  <button
                    key={pill}
                    type="button"
                    onClick={() => onAllocPctChange(pill)}
                    className={cn(
                      "rounded-xl border py-1.5 text-xs font-bold transition-all",
                      isActive
                        ? "border-gold-500 bg-gold-500/20 text-gold-300 ring-1 ring-gold-500/40"
                        : "border-hairline bg-base text-content-muted hover:border-gold-500/30 hover:text-content"
                    )}
                  >
                    {pill}%
                  </button>
                );
              })}
            </div>
          </div>

          {/* FDV Selector */}
          <div>
            <label className="block text-xs font-semibold text-content-muted mb-1.5">
              FDV (Fully Diluted Valuation)
            </label>
            <div className="flex gap-2">
              <select
                value={fdv}
                onChange={(e) => onFdvChange(e.target.value)}
                className="w-full rounded-xl border border-hairline bg-base px-3 py-2 text-sm font-semibold text-content outline-none focus:border-gold-500/60 transition-colors cursor-pointer"
              >
                {FDV_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label} FDV
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Right Sub-Column: Estimated Value Box (6 cols on lg) */}
        <div className="flex flex-col justify-between rounded-xl border border-gold-500/20 bg-gradient-to-b from-surface-2 to-base p-4 sm:p-5 lg:col-span-6">
          <div>
            <div className="flex items-center justify-between text-content-subtle">
              <span className="text-xs font-semibold tracking-wider text-content-muted">
                Estimated Value
              </span>
              <Info className="h-3.5 w-3.5" />
            </div>

            {/* Big Hero Estimated Range */}
            <div className="mt-2 text-center sm:text-left">
              <div className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-gold-200">
                {usdCompact(estRange.low)} – {usdCompact(estRange.high)}
              </div>
              <div className="text-[11px] text-content-subtle mt-0.5">
                Estimated value range
              </div>
            </div>

            {/* 2x2 Grid */}
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-lg border border-hairline bg-surface-2 p-2.5">
                <div className="text-[11px] text-content-subtle">Gross Value</div>
                <div className="mono mt-0.5 font-display text-base font-bold text-content">
                  {usdCompact(value.grossUsd)}
                </div>
              </div>

              <div className="rounded-lg border border-hairline bg-surface-2 p-2.5">
                <div className="text-[11px] text-content-subtle">Liquid at TGE</div>
                <div className="mono mt-0.5 font-display text-base font-bold text-mint-400">
                  {usdCompact(value.liquidAtTgeUsd)}
                </div>
              </div>

              <div className="rounded-lg border border-hairline bg-surface-2 p-2.5">
                <div className="text-[11px] text-content-subtle">Estimated Tokens</div>
                <div className="mono mt-0.5 font-display text-base font-bold text-content">
                  {Math.round(value.tokens).toLocaleString("en-US")}
                </div>
              </div>

              <div className="rounded-lg border border-hairline bg-surface-2 p-2.5">
                <div className="text-[11px] text-content-subtle">Your Share of Pool</div>
                <div className="mono mt-0.5 font-display text-base font-bold text-gold-300">
                  {value.sharePct < 0.01 ? "<0.01%" : `${value.sharePct.toFixed(2)}%`}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Disclaimer */}
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-[11px] text-content-subtle">
            <Info className="h-3.5 w-3.5 shrink-0 text-gold-400 mt-0.5" />
            <span>
              This is an estimate based on current assumptions. Actual results may vary.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
