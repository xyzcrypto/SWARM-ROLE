"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Info, Link2, Unlink } from "lucide-react";
import { platformLogo } from "@/lib/dex-registry";
import { cn } from "@/lib/utils";
import { usdCompact, type CompRange, type ValueResult } from "@modules/points/lib/points";
import type { ProgramView } from "@modules/points/lib/programs";
import { ShareResultButton } from "./ShareResultButton";

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
  allocLinked?: boolean;
  onToggleAllocLink?: (linked: boolean) => void;
  fdv: string;
  onFdvChange: (v: string) => void;
  value: ValueResult;
  range?: CompRange;
  linked?: boolean;
  anchor?: "comps" | "program" | "none";
  anchorFdv?: number;
  onToggleLink?: (linked: boolean) => void;
  /** The new site-wide "points analyzed" total, after this calculation counted. */
  onAnalyzed?: (total: number) => void;
}

export const ALLOC_PILLS = ["10", "20", "30", "50", "100"];

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
  allocLinked = true,
  onToggleAllocLink,
  fdv,
  onFdvChange,
  value,
  range,
  linked = false,
  anchor = "none",
  anchorFdv = 0,
  onToggleLink,
  onAnalyzed,
}: PointsCalculatorCardProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const logo = platformLogo({ links: program.links, logo: program.logo ?? undefined });

  const anchorLabel = anchor === "comps" ? "from comparables" : "from programme";

  const officialAlloc = program.scenario?.allocationPctOfSupply ?? 10;
  const allocPills = useMemo(() => {
    const set = new Set<number>([officialAlloc, 10, 20, 50]);
    if (set.size < 5) set.add(30);
    if (set.size < 5) set.add(100);
    if (set.size < 5) set.add(25);
    if (set.size < 5) set.add(15);
    return Array.from(set).sort((a, b) => a - b).slice(0, 5).map(String);
  }, [officialAlloc]);

  // Exactly 3 compact scenario pills so they always stay on 1 single row
  const scenarioFdvs = program.scenario?.fdvScenariosUsd;
  const primaryFdv = anchorFdv > 0 ? Math.round(anchorFdv) : (scenarioFdvs?.[0] ?? 1_000_000_000);
  const fdvScenarios = Array.from(
    new Set([primaryFdv, 1_000_000_000, 3_000_000_000, 10_000_000_000])
  ).sort((a, b) => a - b).slice(0, 3);

  const website = program.links?.website;
  let domain = "";
  if (website) {
    try {
      domain = new URL(website).hostname.replace(/^www\./, "");
    } catch {
      domain = "";
    }
  }

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

  // Report calculated points to live stats API
  const lastReportedPoints = useRef<number>(0);
  useEffect(() => {
    const pts = Number(yourPoints.replace(/[^0-9]/g, ""));
    if (pts > 0 && Math.abs(pts - lastReportedPoints.current) >= 1000) {
      const timer = setTimeout(() => {
        lastReportedPoints.current = pts;
        // ⚠️ The response carries the NEW total, and it is handed upward so
        // the hero's counter moves as you calculate. Without this the number
        // was fetched once on mount and then sat there - so a reader could
        // watch their own calculation change nothing, which is precisely what
        // made it look invented.
        fetch("/api/points/stats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ points: pts }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => {
            const total = Number(j?.pointsAnalyzed);
            if (Number.isFinite(total) && total > 0) onAnalyzed?.(total);
          })
          .catch(() => {});
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [yourPoints, onAnalyzed]);

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-hairline bg-surface-2 p-5 sm:p-6">
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

            {/* ⚠️ `left-0` on mobile, `right-0` only from `sm`. Anchored
                `right-0` at every width, this 176px panel hung off the LEFT of
                its trigger - and on a phone the trigger starts near the card's
                left edge, so the list was clipped by the viewport with the
                programme names cut in half ("dex", "seX", "riational").
                Picking a programme is the first thing anyone does on this
                card, and it could not be done. */}
            {dropdownOpen && (
              <div className="absolute left-0 right-auto mt-1 z-30 w-44 rounded-xl border border-hairline bg-surface-2 p-1 shadow-elevate sm:left-auto sm:right-0">
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
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-mint-500/30 bg-mint-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-mint-300">
            <CheckCircle2 className="h-3 w-3" />
            <span>Confirmed Data</span>
          </div>
        </div>
      </div>

      {/* Main Content: Split 2 Columns */}
      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Sub-Column: Inputs (6 cols on lg) */}
        <div className="space-y-3 lg:col-span-6">
          {/* Your Points */}
          <div>
            <label className="block text-xs font-semibold text-content-muted mb-1">
              Your Points
            </label>
            <input
              type="text"
              value={yourPoints}
              onChange={(e) => onYourPointsChange(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="Enter your points"
              className="w-full rounded-xl border border-hairline bg-base px-3.5 py-2 text-sm font-semibold text-content outline-none focus:border-gold-500/60 transition-colors"
            />
          </div>

          {/* Total Points */}
          <div>
            <label className="block text-xs font-semibold text-content-muted mb-1">
              Total Points
            </label>
            <input
              type="text"
              value={totalPoints}
              onChange={(e) => onTotalPointsChange(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 72,000,000"
              className="w-full rounded-xl border border-hairline bg-base px-3.5 py-2 text-sm font-semibold text-content outline-none focus:border-gold-500/60 transition-colors"
            />
          </div>

          {/* Allocation % Field */}
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">
                Allocation %
              </span>
              <button
                type="button"
                onClick={() => {
                  if (onToggleAllocLink) {
                    onToggleAllocLink(!allocLinked);
                  }
                }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer",
                  allocLinked
                    ? "bg-mint-500/15 text-mint-200 border border-mint-500/30 hover:bg-mint-500/25"
                    : "text-content-subtle hover:text-content-muted border border-hairline hover:border-gold-500/30"
                )}
              >
                {allocLinked ? <Link2 className="h-3 w-3" /> : <Unlink className="h-3 w-3" />}
                <span>{allocLinked ? "from programme" : "manual"}</span>
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={allocPct}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9.]/g, "");
                  if (allocLinked && onToggleAllocLink) {
                    onToggleAllocLink(false);
                  }
                  onAllocPctChange(raw);
                }}
                placeholder={`e.g. ${officialAlloc}`}
                className={cn(
                  "w-full rounded-xl border px-3.5 py-2 text-sm font-semibold text-content outline-none transition-colors",
                  allocLinked
                    ? "border-mint-500/40 bg-mint-500/[0.04] focus:border-mint-500/60 focus:ring-2 focus:ring-mint-500/20"
                    : "border-hairline bg-base focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
                )}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-content-subtle">
                %
              </span>
            </div>

            {/* Quick Scenario Pills */}
            <div className="mt-1.5 grid grid-cols-5 gap-1.5">
              {allocPills.map((pill) => {
                const isActive = Math.abs(Number(allocPct) - Number(pill)) < 0.01;
                return (
                  <button
                    key={pill}
                    type="button"
                    onClick={() => {
                      const isOfficial = Math.abs(Number(pill) - officialAlloc) < 0.01;
                      onToggleAllocLink?.(isOfficial);
                      onAllocPctChange(pill);
                    }}
                    aria-pressed={isActive}
                    className={cn(
                      "rounded-lg border py-1 text-center text-[11px] font-medium transition-colors truncate",
                      isActive
                        ? "border-gold-500/40 bg-gold-500/15 text-gold-200 ring-1 ring-gold-500/30 font-semibold"
                        : "border-hairline text-content-subtle hover:border-gold-500/30 hover:text-content-muted active:border-gold-500/30"
                    )}
                  >
                    {pill}%
                  </button>
                );
              })}
            </div>

            {/* Implied / Scenario Caption */}
            <span className="mt-1 block text-[10.5px] text-content-subtle">
              {allocLinked
                ? `${officialAlloc}% of supply · ${program.name} scenario`
                : "· manual assumption"}
            </span>
          </div>

          {/* FDV Field */}
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">
                FDV
              </span>
              <button
                type="button"
                onClick={() => {
                  if (onToggleLink) {
                    onToggleLink(!linked);
                  }
                }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer",
                  linked
                    ? "bg-mint-500/15 text-mint-200 border border-mint-500/30 hover:bg-mint-500/25"
                    : "text-content-subtle hover:text-content-muted border border-hairline hover:border-gold-500/30"
                )}
              >
                {linked ? <Link2 className="h-3 w-3" /> : <Unlink className="h-3 w-3" />}
                <span>{linked ? anchorLabel : "manual"}</span>
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={fdv}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, "");
                  if (linked && onToggleLink) {
                    onToggleLink(false);
                  }
                  onFdvChange(raw);
                }}
                placeholder="e.g. 290000000"
                className={cn(
                  "w-full rounded-xl border px-3.5 py-2 text-sm font-semibold text-content outline-none transition-colors",
                  linked
                    ? "border-mint-500/40 bg-mint-500/[0.04] focus:border-mint-500/60 focus:ring-2 focus:ring-mint-500/20"
                    : "border-hairline bg-base focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
                )}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-content-subtle">
                USD
              </span>
            </div>

            {/* Quick Scenario Pills (1 clean row on 3-cols grid) */}
            {fdvScenarios && fdvScenarios.length > 0 && (
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {fdvScenarios.map((v) => {
                  const isActive = Math.abs(Number(fdv) - v) < 1;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        if (anchorFdv > 0 && Math.abs(v - anchorFdv) < 1) {
                          onToggleLink?.(true);
                        } else {
                          onToggleLink?.(false);
                        }
                        onFdvChange(String(v));
                      }}
                      aria-pressed={isActive}
                      className={cn(
                        "rounded-lg border py-1 text-center text-[11px] font-medium transition-colors truncate",
                        isActive
                          ? "border-gold-500/40 bg-gold-500/15 text-gold-200 ring-1 ring-gold-500/30 font-semibold"
                          : "border-hairline text-content-subtle hover:border-gold-500/30 hover:text-content-muted active:border-gold-500/30"
                      )}
                    >
                      {usdCompact(v)} FDV
                    </button>
                  );
                })}
              </div>
            )}

            {/* Implied Price Caption */}
            <span className="mt-1 block text-[10.5px] text-content-subtle">
              Implied price: ${value.priceUsd.toLocaleString("en-US", { maximumFractionDigits: 4 })}
              {linked && anchor === "comps" ? ` · peers of ${program.name}` : ""}
              {linked && anchor === "program" ? ` · ${program.name} scenario` : ""}
              {!linked ? " · manual assumption" : ""}
            </span>
          </div>
        </div>

        {/* Right Sub-Column: Estimated Value Box (6 cols on lg) */}
        <div className="flex flex-col justify-between rounded-xl border border-gold-500/20 bg-gradient-to-b from-surface-2 to-base p-4 lg:col-span-6">
          <div>
            <div className="flex items-center justify-between text-content-subtle">
              <span className="text-xs font-semibold tracking-wider text-content-muted">
                Estimated Value
              </span>
              <Info className="h-3.5 w-3.5" />
            </div>

            {/* Big Hero Estimated Range */}
            <div className="mt-1.5 text-center sm:text-left">
              <div className="font-display text-2xl font-bold tracking-tight text-gold-200">
                {usdCompact(estRange.low)} – {usdCompact(estRange.high)}
              </div>
              <div className="text-[10.5px] text-content-subtle mt-0.5">
                Estimated value range
              </div>
            </div>

            {/* 2x2 Grid */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-hairline bg-surface-2 p-2">
                <div className="text-[10.5px] text-content-subtle">Gross Value</div>
                <div className="mono mt-0.5 font-display text-sm sm:text-[15px] font-bold text-content">
                  {usdCompact(value.grossUsd)}
                </div>
              </div>

              <div className="rounded-lg border border-hairline bg-surface-2 p-2">
                <div className="text-[10.5px] text-content-subtle">Liquid at TGE</div>
                <div className="mono mt-0.5 font-display text-sm sm:text-[15px] font-bold text-mint-400">
                  {usdCompact(value.liquidAtTgeUsd)}
                </div>
              </div>

              <div className="rounded-lg border border-hairline bg-surface-2 p-2">
                <div className="text-[10.5px] text-content-subtle">Estimated Tokens</div>
                <div className="mono mt-0.5 font-display text-sm sm:text-[15px] font-bold text-content">
                  {Math.round(value.tokens).toLocaleString("en-US")}
                </div>
              </div>

              <div className="rounded-lg border border-hairline bg-surface-2 p-2">
                <div className="text-[10.5px] text-content-subtle">Your Share of Pool</div>
                <div className="mono mt-0.5 font-display text-sm sm:text-[15px] font-bold text-gold-300">
                  {value.sharePct === 0 ? "0.00%" : value.sharePct < 0.01 ? "<0.01%" : `${value.sharePct.toFixed(2)}%`}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action Footer: Disclaimer + Share Result Button */}
          <div className="mt-3 flex items-center justify-between gap-2 pt-2.5 border-t border-hairline">
            <div className="flex items-center gap-1.5 text-[10.5px] text-content-subtle">
              <Info className="h-3 w-3 shrink-0 text-gold-400" />
              <span>Estimate based on assumptions.</span>
            </div>

            <ShareResultButton
              className="shrink-0"
              payload={() => ({
                platform: program.name,
                domain,
                sharePct: value.sharePct,
                tokens: Math.round(value.tokens),
                usd: Math.round(value.grossUsd),
                fdv: Number(fdv) || 0,
              })}
            />
          </div>
        </div>
      </div>

      {/* ⚠️ Nothing here is a forecast disclosure */}
      <details className="group mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] text-amber-200/90 transition-colors">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2 text-[11.5px] font-medium [&::-webkit-details-marker]:hidden">
          <span aria-hidden className="text-amber-400">⚠</span>
          <span>Nothing here is a forecast. Volumes are live; the conversion is your assumption.</span>
          <ChevronDown
            className="ml-auto h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180 text-amber-400/80"
            strokeWidth={1.7}
          />
        </summary>
        <p className="px-3.5 pb-2.5 pl-8 text-[11px] leading-relaxed text-amber-200/80">
          No perp DEX publishes a points-to-token rate before TGE. Volumes and peer valuations on this page are
          live market data; the conversion from points to tokens is an assumption you control, and every input
          is editable.
        </p>
      </details>
    </div>
  );
}
