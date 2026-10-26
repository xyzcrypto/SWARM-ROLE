"use client";

import React, { useState } from "react";
import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DonutSegment {
  name: string;
  value: number; // Percentage (0-100)
  formattedValue?: string;
  color: string; // Hex color for SVG stroke
  bgClass?: string; // Tailwind class for legend dot
}

export interface DonutPieChartProps {
  title: string;
  subtitle?: string;
  totalLabel: string;
  totalValue: string;
  segments: DonutSegment[];
  insightText?: string;
  className?: string;
}

export function DonutPieChart({
  title,
  subtitle,
  totalLabel,
  totalValue,
  segments,
  insightText,
  className,
}: DonutPieChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // SVG dimensions & math
  const size = 160;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2; // radius ~69
  const circumference = 2 * Math.PI * radius; // ~433.54

  // Calculate cumulative offsets
  let cumulativePercent = 0;

  const activeSegment = hoveredIdx !== null ? segments[hoveredIdx] : null;

  return (
    <div
      className={cn(
        "neu-card rounded-2xl p-3.5 sm:p-4 border border-white/60 dark:border-white/[0.08] shadow-neu flex flex-col justify-between transition-all hover:border-white/20",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
            <span>{title}</span>
          </h4>
          {subtitle && <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>}
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20">
          Distribution
        </span>
      </div>

      {/* Main Chart + Legend Body */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-center my-auto">
        {/* SVG Donut Circle */}
        <div className="sm:col-span-5 flex items-center justify-center relative">
          <div className="relative w-[150px] h-[150px] flex items-center justify-center">
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className="w-full h-full -rotate-90 transform drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
            >
              {/* Background ring */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth - 4}
                className="text-zinc-200 dark:text-zinc-800/60"
              />

              {/* Segments */}
              {segments.map((seg, idx) => {
                const strokeDasharray = `${(seg.value / 100) * circumference} ${circumference}`;
                const strokeDashoffset = -((cumulativePercent / 100) * circumference);
                cumulativePercent += seg.value;

                const isHovered = hoveredIdx === idx;

                return (
                  <circle
                    key={seg.name}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="butt"
                    className="cursor-pointer transition-all duration-200"
                    style={{
                      opacity: hoveredIdx === null || isHovered ? 1 : 0.45,
                      filter: isHovered ? `drop-shadow(0 0 6px ${seg.color})` : "none",
                    }}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                );
              })}
            </svg>

            {/* Central Readout */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2">
              <span className="text-[10px] uppercase font-semibold text-zinc-500 dark:text-zinc-400 truncate max-w-[90px]">
                {activeSegment ? activeSegment.name : totalLabel}
              </span>
              <span className="text-sm sm:text-base font-black text-zinc-900 dark:text-zinc-100 tracking-tight mono">
                {activeSegment ? `${activeSegment.value.toFixed(1)}%` : totalValue}
              </span>
              {activeSegment?.formattedValue && (
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mono">
                  {activeSegment.formattedValue}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Legend on the right */}
        <div className="sm:col-span-7 space-y-1.5">
          {segments.map((seg, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <div
                key={seg.name}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={cn(
                  "flex items-center justify-between text-xs py-1 px-2 rounded-lg cursor-pointer transition-all",
                  isHovered
                    ? "bg-black/5 dark:bg-white/[0.07] scale-[1.02]"
                    : "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span
                    className={cn(
                      "font-semibold truncate",
                      isHovered ? "text-zinc-900 dark:text-white" : "text-zinc-700 dark:text-zinc-300"
                    )}
                  >
                    {seg.name}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 mono shrink-0">
                  {seg.formattedValue && (
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium hidden xs:inline">
                      {seg.formattedValue}
                    </span>
                  )}
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 w-11 text-right">
                    {seg.value.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Market Insight Callout */}
      {insightText && (
        <div className="mt-3 pt-2.5 border-t border-black/[0.05] dark:border-white/[0.06]">
          <div className="flex items-start gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-zinc-900 dark:text-zinc-200">Market Insight: </strong>
              <span>{insightText}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export interface BarRankItem {
  label: string;
  sublabel?: string;
  value: number; // numeric value for relative width (0 to max)
  displayValue: string;
  change?: number; // e.g. +4.2
  color?: string; // gradient classes or hex
  badge?: string;
  badgeTone?: "mint" | "amber" | "blue" | "purple";
  icon?: React.ReactNode;
}

export interface BarRankChartProps {
  title: string;
  subtitle?: string;
  items: BarRankItem[];
  insightText?: string;
  className?: string;
}

export function BarRankChart({
  title,
  subtitle,
  items,
  insightText,
  className,
}: BarRankChartProps) {
  const maxValue = Math.max(...items.map((i) => i.value), 1);

  return (
    <div
      className={cn(
        "neu-card rounded-2xl p-3.5 sm:p-4 border border-white/60 dark:border-white/[0.08] shadow-neu flex flex-col justify-between transition-all hover:border-white/20",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
            <span>{title}</span>
          </h4>
          {subtitle && <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>}
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20">
          Rankings
        </span>
      </div>

      {/* Bar List */}
      <div className="space-y-2.5 my-auto">
        {items.map((item, idx) => {
          const widthPct = Math.min(100, Math.max(6, (item.value / maxValue) * 100));
          return (
            <div key={item.label} className="space-y-1 group">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="mono text-[10px] font-bold text-zinc-400 dark:text-zinc-500 w-3.5 shrink-0">
                    {idx + 1}
                  </span>
                  {item.icon && <span className="shrink-0">{item.icon}</span>}
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-amber-500 transition-colors truncate">
                    {item.label}
                  </span>
                  {item.sublabel && (
                    <span className="text-[10px] text-zinc-500 truncate hidden sm:inline">
                      {item.sublabel}
                    </span>
                  )}
                  {item.badge && (
                    <span
                      className={cn(
                        "text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border hidden xs:inline shrink-0",
                        item.badgeTone === "mint"
                          ? "bg-mint-500/15 text-mint-400 border-mint-500/25"
                          : item.badgeTone === "blue"
                          ? "bg-blue-500/15 text-blue-400 border-blue-500/25"
                          : item.badgeTone === "purple"
                          ? "bg-purple-500/15 text-purple-400 border-purple-500/25"
                          : "bg-amber-500/15 text-amber-500 border-amber-500/25"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mono shrink-0">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs">
                    {item.displayValue}
                  </span>
                  {item.change !== undefined && (
                    <span
                      className={cn(
                        "text-[10px] font-bold px-1 rounded flex items-center gap-0.5",
                        item.change >= 0
                          ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                          : "text-rose-600 dark:text-rose-400 bg-rose-500/10"
                      )}
                    >
                      {item.change >= 0 ? "+" : ""}
                      {item.change.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Bar track */}
              <div className="h-1.5 w-full rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500 bg-gradient-to-r",
                    item.color || "from-amber-500 to-amber-400"
                  )}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Market Insight Callout */}
      {insightText && (
        <div className="mt-3 pt-2.5 border-t border-black/[0.05] dark:border-white/[0.06]">
          <div className="flex items-start gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-zinc-900 dark:text-zinc-200">Market Insight: </strong>
              <span>{insightText}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export interface ComparativeItem {
  label: string;
  sublabel?: string;
  value: number; // positive or negative value
  displayValue?: string;
  icon?: React.ReactNode;
}

export interface ComparativeBarChartProps {
  title: string;
  subtitle?: string;
  items: ComparativeItem[];
  insightText?: string;
  className?: string;
}

export function ComparativeBarChart({
  title,
  subtitle,
  items,
  insightText,
  className,
}: ComparativeBarChartProps) {
  // Find max absolute value to scale relative to center 50%
  const maxAbs = Math.max(...items.map((i) => Math.abs(i.value)), 1);

  return (
    <div
      className={cn(
        "neu-card rounded-2xl p-3.5 sm:p-4 border border-white/60 dark:border-white/[0.08] shadow-neu flex flex-col justify-between transition-all hover:border-white/20",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
            <span>{title}</span>
          </h4>
          {subtitle && <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="text-rose-500 font-bold">- Outflow</span>
          <span className="text-zinc-400">|</span>
          <span className="text-emerald-500 font-bold">+ Inflow</span>
        </div>
      </div>

      {/* Comparative Bars */}
      <div className="space-y-2.5 my-auto">
        {items.map((item) => {
          const isPositive = item.value >= 0;
          const barWidth = Math.min(50, (Math.abs(item.value) / maxAbs) * 50);

          return (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  {item.icon && <span className="shrink-0">{item.icon}</span>}
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                    {item.label}
                  </span>
                  {item.sublabel && (
                    <span className="text-[10px] text-zinc-500 hidden sm:inline">
                      {item.sublabel}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "mono font-bold text-xs",
                    isPositive ? "text-emerald-600 dark:text-mint-400" : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {item.displayValue || `${isPositive ? "+" : ""}${item.value.toFixed(1)}%`}
                </span>
              </div>

              {/* Bi-directional center-aligned bar */}
              <div className="relative h-2 w-full rounded-full bg-black/5 dark:bg-white/5 overflow-hidden flex items-center">
                {/* Center marker line */}
                <div className="absolute left-1/2 top-0 bottom-0 w-[1.5px] bg-zinc-400 dark:bg-zinc-600 z-10 -translate-x-1/2" />

                {/* Left side (Negative) */}
                <div className="w-1/2 h-full flex justify-end">
                  {!isPositive && (
                    <div
                      className="h-full rounded-l-full bg-gradient-to-l from-rose-500 to-rose-600 transition-all duration-500"
                      style={{ width: `${barWidth * 2}%` }}
                    />
                  )}
                </div>

                {/* Right side (Positive) */}
                <div className="w-1/2 h-full flex justify-start">
                  {isPositive && (
                    <div
                      className="h-full rounded-r-full bg-gradient-to-r from-emerald-500 to-mint-400 transition-all duration-500"
                      style={{ width: `${barWidth * 2}%` }}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Market Insight Callout */}
      {insightText && (
        <div className="mt-3 pt-2.5 border-t border-black/[0.05] dark:border-white/[0.06]">
          <div className="flex items-start gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-zinc-900 dark:text-zinc-200">Market Insight: </strong>
              <span>{insightText}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
