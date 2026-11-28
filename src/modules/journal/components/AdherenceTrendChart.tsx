"use client";

import { useId, useMemo, useState } from "react";
import type { AdherencePoint } from "@/lib/risk";

const W = 720;
const H = 160;
const PAD = 24;

function scoreColor(score: number): string {
  if (score >= 80) return "#22d692";
  if (score >= 50) return "#f5b74e";
  return "#f43f5e";
}

// Hand-rolled SVG line chart, fixed 0-100 y-range (simpler than EquityCurveChart's
// signed-value mapping since a score can never go negative). Colored by the same
// thresholds already used for the score badge in RiskPanel.
export function AdherenceTrendChart({ points }: { points: AdherencePoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const uid = useId();
  const gradId = `adh-${uid}`;

  const { path, area, dots } = useMemo(() => {
    if (points.length === 0) return { path: "", area: "", dots: [] as { x: number; y: number }[] };
    const y = (v: number) => H - PAD - (v / 100) * (H - PAD * 2);
    const x = (i: number) => (points.length === 1 ? W / 2 : PAD + (i / (points.length - 1)) * (W - PAD * 2));
    const dots = points.map((p, i) => ({ x: x(i), y: y(p.score) }));
    const path = dots.map((d, i) => `${i === 0 ? "M" : "L"} ${d.x} ${d.y}`).join(" ");
    const area = `${path} L ${dots[dots.length - 1].x} ${y(0)} L ${dots[0].x} ${y(0)} Z`;
    return { path, area, dots };
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="flex h-[10rem] items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-zinc-600">
        Log a few trades to see your discipline trend over time.
      </div>
    );
  }

  const last = points[points.length - 1];
  const lineColor = scoreColor(last.score);
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
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="currentColor" className="text-white/10" strokeDasharray="4 4" />
        <path d={area} fill={`url(#${gradId})`} opacity={0.18} />
        <path d={path} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hoverDot && (
          <>
            <line x1={hoverDot.x} y1={PAD / 2} x2={hoverDot.x} y2={H - PAD / 2} stroke="currentColor" className="text-white/10" />
            <circle cx={hoverDot.x} cy={hoverDot.y} r={4} fill={lineColor} />
          </>
        )}
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>
      {hoverPoint && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-lg border border-line bg-ink-950/90 px-3 py-1.5 text-xs text-zinc-200 shadow-elevate">
          <span className="mono">{new Date(hoverPoint.date).toLocaleDateString()}</span> ·{" "}
          <span className="mono" style={{ color: scoreColor(hoverPoint.score) }}>
            {hoverPoint.score}/100
          </span>
        </div>
      )}
      <table className="sr-only">
        <caption>Rule-adherence score over time</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <td>{new Date(p.date).toLocaleDateString()}</td>
              <td>{p.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
