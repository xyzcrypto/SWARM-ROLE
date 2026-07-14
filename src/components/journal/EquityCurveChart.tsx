"use client";

import { useId, useMemo, useState } from "react";
import type { EquityPoint } from "@/lib/journal";

const W = 720;
const H = 220;
const PAD = 28;

// Hand-rolled SVG line/area chart with a signed y() mapping + zero baseline -
// reused for both the equity curve and the drawdown curve (drawdown values
// are always <= 0, so the same "can go negative" rendering applies). Not a
// TrendChart reuse because TrendChart assumes an always-positive daily series.
export function EquityCurveChart({
  points,
  emptyLabel = "No closed trades yet - your equity curve appears here.",
  captionLabel = "Cumulative realized P&L over time",
}: {
  points: EquityPoint[];
  emptyLabel?: string;
  captionLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const uid = useId();
  const mintGradId = `eq-mint-${uid}`;
  const roseGradId = `eq-rose-${uid}`;

  const { path, area, zeroY, dots, minV, maxV } = useMemo(() => {
    if (points.length === 0) return { path: "", area: "", zeroY: H / 2, dots: [] as { x: number; y: number }[], minV: 0, maxV: 0 };
    const values = points.map((p) => p.cumPnl);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const range = max - min || 1;
    const y = (v: number) => H - PAD - ((v - min) / range) * (H - PAD * 2);
    const x = (i: number) => (points.length === 1 ? W / 2 : PAD + (i / (points.length - 1)) * (W - PAD * 2));

    const dots = points.map((p, i) => ({ x: x(i), y: y(p.cumPnl) }));
    const path = dots.map((d, i) => `${i === 0 ? "M" : "L"} ${d.x} ${d.y}`).join(" ");
    const area = `${path} L ${dots[dots.length - 1].x} ${y(min < 0 ? min : 0)} L ${dots[0].x} ${y(min < 0 ? min : 0)} Z`;
    return { path, area, zeroY: y(0), dots, minV: min, maxV: max };
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-zinc-600">
        {emptyLabel}
      </div>
    );
  }

  const last = points[points.length - 1];
  const positive = last.cumPnl >= 0;
  const hoverPoint = hover != null ? points[hover] : null;
  const hoverDot = hover != null ? dots[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * W;
          let closest = 0;
          let bestDist = Infinity;
          dots.forEach((d, i) => {
            const dist = Math.abs(d.x - relX);
            if (dist < bestDist) {
              bestDist = dist;
              closest = i;
            }
          });
          setHover(closest);
        }}
        onMouseLeave={() => setHover(null)}
      >
        <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke="currentColor" className="text-white/10" strokeDasharray="4 4" />
        <path d={area} fill={positive ? `url(#${mintGradId})` : `url(#${roseGradId})`} opacity={0.18} />
        <path d={path} fill="none" stroke={positive ? "#22d692" : "#f43f5e"} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hoverDot && (
          <>
            <line x1={hoverDot.x} y1={PAD / 2} x2={hoverDot.x} y2={H - PAD / 2} stroke="currentColor" className="text-white/10" />
            <circle cx={hoverDot.x} cy={hoverDot.y} r={4} fill={positive ? "#22d692" : "#f43f5e"} />
          </>
        )}
        <defs>
          <linearGradient id={mintGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d692" />
            <stop offset="100%" stopColor="#22d692" stopOpacity={0} />
          </linearGradient>
          <linearGradient id={roseGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity={0} />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>
        </defs>
      </svg>
      {hoverPoint && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-lg border border-line bg-ink-950/90 px-3 py-1.5 text-xs text-zinc-200 shadow-elevate">
          <span className="mono">{new Date(hoverPoint.date).toLocaleDateString()}</span> ·{" "}
          <span className={hoverPoint.cumPnl >= 0 ? "text-mint-300" : "text-rose-300"}>
            ${hoverPoint.cumPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </div>
      )}
      <table className="sr-only">
        <caption>{captionLabel}</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Cumulative P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <td>{new Date(p.date).toLocaleDateString()}</td>
              <td>${p.cumPnl.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-center text-[11px] text-zinc-600">
        Range: ${minV.toLocaleString(undefined, { maximumFractionDigits: 0 })} to ${maxV.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </p>
    </div>
  );
}
