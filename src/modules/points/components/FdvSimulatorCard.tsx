"use client";

import { useMemo, useState } from "react";
import { usdCompact, type ValueResult } from "@modules/points/lib/points";

interface FdvSimulatorCardProps {
  currentFdv: number;
  onFdvChange: (fdv: string) => void;
  yourPoints: number;
  totalPoints: number;
  allocationPct: number;
  totalSupply: number;
  tgeUnlockPct: number;
}

const FDV_STOPS = [
  { label: "$100M", value: 100_000_000 },
  { label: "$300M", value: 300_000_000 },
  { label: "$500M", value: 500_000_000 },
  { label: "$1B", value: 1_000_000_000 },
  { label: "$3B", value: 3_000_000_000 },
];

export function FdvSimulatorCard({
  currentFdv,
  onFdvChange,
  yourPoints,
  totalPoints,
  allocationPct,
  totalSupply,
  tgeUnlockPct,
}: FdvSimulatorCardProps) {
  // Slider state mapped linearly to log/power scale of FDV (from 100M to 3B)
  const minFdv = 100_000_000;
  const maxFdv = 3_000_000_000;

  // Calculate values across standard X stops
  const pointsOnChart = useMemo(() => {
    const totalPool = totalPoints || 1;
    const share = yourPoints / totalPool;
    const tokens = share * (totalSupply * (allocationPct / 100));

    return FDV_STOPS.map((stop) => {
      const tokenPrice = stop.value / (totalSupply || 1);
      const gross = tokens * tokenPrice;
      const liquid = gross * (tgeUnlockPct / 100);
      return {
        ...stop,
        gross,
        liquid,
      };
    });
  }, [yourPoints, totalPoints, allocationPct, totalSupply, tgeUnlockPct]);

  // Current values
  const currentTokenPrice = currentFdv / (totalSupply || 1);
  const currentTokens = (yourPoints / (totalPoints || 1)) * (totalSupply * (allocationPct / 100));
  const currentGross = currentTokens * currentTokenPrice;
  const currentLiquid = currentGross * (tgeUnlockPct / 100);

  // SVG Chart Geometry
  const width = 500;
  const height = 180;
  const padding = { top: 20, right: 20, bottom: 30, left: 55 };

  const maxVal = Math.max(
    ...pointsOnChart.map((p) => p.gross),
    currentGross,
    2500
  ) * 1.1;

  // Coordinate mappers
  const getX = (fdvVal: number) => {
    // Log scale for X
    const minLog = Math.log10(minFdv);
    const maxLog = Math.log10(maxFdv);
    const currentLog = Math.log10(Math.max(minFdv, Math.min(maxFdv, fdvVal)));
    const pct = (currentLog - minLog) / (maxLog - minLog);
    return padding.left + pct * (width - padding.left - padding.right);
  };

  const getY = (val: number) => {
    const pct = val / maxVal;
    return height - padding.bottom - pct * (height - padding.top - padding.bottom);
  };

  // Build SVG path strings
  const grossPath = pointsOnChart.reduce((acc, p, idx) => {
    const x = getX(p.value);
    const y = getY(p.gross);
    return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, "");

  const liquidPath = pointsOnChart.reduce((acc, p, idx) => {
    const x = getX(p.value);
    const y = getY(p.liquid);
    return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, "");

  const currentX = getX(currentFdv);
  const currentYGross = getY(currentGross);

  // Y-axis ticks
  const yTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-hairline bg-surface-2 p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-hairline">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-content sm:text-xl">
            FDV Simulator
          </h2>
          <p className="text-xs text-content-muted">
            Move the slider to see how your value changes
          </p>
        </div>

        {/* Current FDV Badge */}
        <div className="rounded-xl border border-hairline bg-base px-3 py-1 text-xs font-bold text-gold-300">
          {usdCompact(currentFdv)}
        </div>
      </div>

      {/* Slider Control */}
      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-content-subtle mono">
          <span>$100M</span>
          <span>$3B</span>
        </div>
        <input
          type="range"
          min={minFdv}
          max={maxFdv}
          step={50_000_000}
          value={currentFdv}
          onChange={(e) => onFdvChange(e.target.value)}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-base accent-gold-400"
        />
      </div>

      {/* SVG Chart */}
      <div className="mt-4 w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible">
          {/* Grid lines */}
          {yTicks.map((tick, i) => {
            const y = getY(tick);
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="currentColor"
                  className="text-white/5"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-content-subtle text-[9px] mono"
                >
                  {usdCompact(tick)}
                </text>
              </g>
            );
          })}

          {/* X Axis labels */}
          {FDV_STOPS.map((stop) => {
            const x = getX(stop.value);
            return (
              <text
                key={stop.value}
                x={x}
                y={height - 10}
                textAnchor="middle"
                className="fill-content-subtle text-[9px] mono"
              >
                {stop.label}
              </text>
            );
          })}

          {/* Lines */}
          <path d={grossPath} fill="none" stroke="#f59e0b" strokeWidth={2.5} strokeLinecap="round" />
          <path d={liquidPath} fill="none" stroke="#e2e8f0" strokeWidth={1.75} strokeLinecap="round" />

          {/* Current FDV Indicator Pin */}
          <line
            x1={currentX}
            y1={padding.top}
            x2={currentX}
            y2={height - padding.bottom}
            stroke="#f59e0b"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
          <circle cx={currentX} cy={currentYGross} r={4.5} fill="#f59e0b" className="shadow-lg animate-pulse" />
        </svg>
      </div>

      {/* Chart Legend */}
      <div className="mt-3 flex items-center justify-center gap-6 pt-3 border-t border-hairline text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="text-content-muted">Gross Value</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          <span className="text-content-muted">Liquid at TGE</span>
        </div>
      </div>
    </div>
  );
}
