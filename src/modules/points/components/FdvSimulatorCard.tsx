"use client";

import { useMemo } from "react";
import { usdCompact } from "@modules/points/lib/points";

interface FdvSimulatorCardProps {
  currentFdv: number;
  onFdvChange: (fdv: string) => void;
  yourPoints: number;
  totalPoints: number;
  allocationPct: number;
  totalSupply: number;
  tgeUnlockPct: number;
}

const BASE_FDV_STOPS = [
  { label: "$100M", value: 100_000_000 },
  { label: "$300M", value: 300_000_000 },
  { label: "$500M", value: 500_000_000 },
  { label: "$1B",   value: 1_000_000_000 },
  { label: "$3B",   value: 3_000_000_000 },
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
  // ── 1. Dynamic chart stops (always include currentFdv) ──────────────────
  const chartStops = useMemo(() => {
    const nearEnough = BASE_FDV_STOPS.some(
      (s) => Math.abs(s.value - currentFdv) < 50_000_000
    );
    if (!currentFdv || nearEnough) return BASE_FDV_STOPS;

    const label =
      currentFdv >= 1e12
        ? `$${(currentFdv / 1e12).toFixed(1)}T`
        : currentFdv >= 1e9
        ? `$${(currentFdv / 1e9).toFixed(1)}B`
        : `$${(currentFdv / 1e6).toFixed(0)}M`;

    return [...BASE_FDV_STOPS, { label, value: currentFdv }].sort(
      (a, b) => a.value - b.value
    );
  }, [currentFdv]);

  // ── 2. Chart range derived from stops ───────────────────────────────────
  const chartMinFdv = chartStops[0]?.value ?? 100_000_000;
  const chartMaxFdv = chartStops[chartStops.length - 1]?.value ?? 3_000_000_000;

  // ── 3. Points on chart ──────────────────────────────────────────────────
  const pointsOnChart = useMemo(() => {
    const totalPool = totalPoints || 1;
    const share = yourPoints / totalPool;
    const tokens = share * (totalSupply * (allocationPct / 100));

    return chartStops.map((stop) => {
      const tokenPrice = stop.value / (totalSupply || 1);
      const gross = tokens * tokenPrice;
      const liquid = gross * (tgeUnlockPct / 100);
      return { ...stop, gross, liquid };
    });
  }, [yourPoints, totalPoints, allocationPct, totalSupply, tgeUnlockPct, chartStops]);

  // ── 4. Current values at selected FDV ───────────────────────────────────
  const currentTokenPrice = currentFdv / (totalSupply || 1);
  const currentTokens =
    (yourPoints / (totalPoints || 1)) * (totalSupply * (allocationPct / 100));
  const currentGross = currentTokens * currentTokenPrice;
  const currentLiquid = currentGross * (tgeUnlockPct / 100);

  // ── 5. SVG geometry ─────────────────────────────────────────────────────
  const width = 500;
  const height = 180;
  const padding = { top: 20, right: 20, bottom: 30, left: 55 };

  const maxVal =
    Math.max(...pointsOnChart.map((p) => p.gross), currentGross, 2500) * 1.1;

  // Log-scale X mapper — defined AFTER chartMinFdv / chartMaxFdv
  const getX = (fdvVal: number) => {
    const minLog = Math.log10(chartMinFdv);
    const maxLog = Math.log10(chartMaxFdv);
    const valLog = Math.log10(
      Math.max(chartMinFdv, Math.min(chartMaxFdv, fdvVal))
    );
    const pct = (valLog - minLog) / (maxLog - minLog);
    return padding.left + pct * (width - padding.left - padding.right);
  };

  const getY = (val: number) => {
    const pct = val / maxVal;
    return height - padding.bottom - pct * (height - padding.top - padding.bottom);
  };

  // SVG paths
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

  // Slider labels
  const fmtFdv = (v: number) =>
    v >= 1e12
      ? `$${(v / 1e12).toFixed(1)}T`
      : v >= 1e9
      ? `$${(v / 1e9).toFixed(1)}B`
      : `$${(v / 1e6).toFixed(0)}M`;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-hairline bg-surface-2 p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-hairline">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-content sm:text-xl">
            FDV Simulator
          </h2>
          <p className="text-xs text-content-muted">
            Move the slider or type a value to see how your value changes
          </p>
        </div>

        {/* Manual FDV input */}
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-content-muted">
            $
          </span>
          <input
            type="text"
            defaultValue={fmtFdv(currentFdv).replace("$", "")}
            key={currentFdv}
            onBlur={(e) => {
              const raw = e.target.value.trim().replace(/[$,]/g, "");
              let parsed = 0;
              if (/^[\d.]+[tT]$/.test(raw)) parsed = parseFloat(raw) * 1e12;
              else if (/^[\d.]+[bB]$/.test(raw)) parsed = parseFloat(raw) * 1e9;
              else if (/^[\d.]+[mM]$/.test(raw)) parsed = parseFloat(raw) * 1e6;
              else if (/^[\d.]+$/.test(raw)) parsed = parseFloat(raw);
              if (parsed >= 1_000_000) onFdvChange(String(Math.round(parsed)));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            placeholder="e.g. 1B or 500M"
            className="w-28 rounded-xl border border-gold-500/30 bg-base pl-5 pr-2 py-1 text-xs font-bold text-gold-300 outline-none focus:border-gold-500/60 transition-colors"
          />
        </div>
      </div>

      {/* Slider */}
      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-content-subtle mono">
          <span>{fmtFdv(chartMinFdv)}</span>
          <span className="text-gold-400 font-semibold">
            {usdCompact(currentFdv)} selected
          </span>
          <span>{fmtFdv(chartMaxFdv)}</span>
        </div>
        <input
          type="range"
          min={chartMinFdv}
          max={chartMaxFdv}
          step={50_000_000}
          value={Math.min(currentFdv, chartMaxFdv)}
          onChange={(e) => onFdvChange(e.target.value)}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-base accent-gold-400"
        />

        {/* Quick preset pills */}
        <div className="flex items-center gap-1.5 pt-1 flex-wrap">
          {BASE_FDV_STOPS.map((stop) => (
            <button
              key={stop.value}
              type="button"
              onClick={() => onFdvChange(String(stop.value))}
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-all ${
                Math.abs(currentFdv - stop.value) < 50_000_000
                  ? "border-gold-500 bg-gold-500/20 text-gold-300"
                  : "border-hairline bg-base text-content-muted hover:border-gold-500/30 hover:text-content"
              }`}
            >
              {stop.label}
            </button>
          ))}
        </div>
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
          {chartStops.map((stop) => {
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

          {/* Current FDV pin */}
          <line
            x1={currentX}
            y1={padding.top}
            x2={currentX}
            y2={height - padding.bottom}
            stroke="#f59e0b"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
          <circle
            cx={currentX}
            cy={currentYGross}
            r={4.5}
            fill="#f59e0b"
            className="shadow-lg animate-pulse"
          />
        </svg>
      </div>

      {/* Legend */}
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
