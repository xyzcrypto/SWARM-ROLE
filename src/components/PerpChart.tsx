"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

const FALLBACK = (() => {
  const pts: number[] = [];
  let v = 64000;
  for (let i = 0; i < 48; i++) {
    v += Math.sin(i / 4) * 320 + (i - 24) * 55;
    pts.push(Math.round(v));
  }
  return pts;
})();

export function PerpChart() {
  const [points, setPoints] = useState<number[]>(FALLBACK);
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState(0);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const r = await fetch("/api/chart", { cache: "no-store" });
        if (!r.ok) throw new Error("bad");
        const d = await r.json();
        if (!active || !Array.isArray(d.points) || d.points.length < 2) return;
        setPoints(d.points);
        setPrice(d.price);
        setChange(d.change);
        setLive(Boolean(d.live));
      } catch {
        if (active) setLive(false);
      }
    }
    load();
    const t = setInterval(load, 60_000); // refresh live price every 60s
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  const { line, area, lastY } = useMemo(() => {
    const W = 400, H = 110, pad = 10;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const sx = W / (points.length - 1);
    const coords = points.map((p, i) => [
      i * sx,
      H - ((p - min) / range) * (H - pad * 2) - pad,
    ]);
    const line = coords.map((c, i) => `${i ? "L" : "M"}${c[0].toFixed(1)} ${c[1].toFixed(1)}`).join(" ");
    const area = `${line} L${W} ${H} L0 ${H} Z`;
    return { line, area, lastY: coords[coords.length - 1][1] };
  }, [points]);

  const up = change >= 0;
  const stroke = up ? "#22d692" : "#f87171";
  const priceLabel =
    price != null ? `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "$—";

  return (
    <div className="relative mt-7 h-28 overflow-hidden rounded-2xl border border-line bg-ink-950/60">
      <svg viewBox="0 0 400 110" className="h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="perpfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={up ? "rgba(34,214,146,0.35)" : "rgba(248,113,113,0.3)"} />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>
        </defs>
        <motion.path
          d={area}
          fill="url(#perpfill)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        />
        <motion.path
          key={line}
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.6, ease: "easeOut" }}
        />
      </svg>

      {/* sweeping scan line */}
      <div
        className="absolute inset-y-0 left-0 w-16 -skew-x-12 bg-gradient-to-r from-transparent via-white/8 to-transparent"
        style={{ animation: "sheen 3.5s ease-in-out infinite" }}
      />

      {/* live price + change */}
      <div className="absolute right-3 top-2.5 flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400 opacity-70" />}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${live ? "bg-mint-400" : "bg-amber-400"}`} />
        </span>
        <span className="mono text-[11px] font-semibold text-zinc-100">{priceLabel}</span>
        <span className={`mono text-[11px] ${up ? "text-mint-300" : "text-red-300"}`}>
          {up ? "+" : ""}{change.toFixed(2)}%
        </span>
      </div>

      {/* pulsing last-price marker (right edge) */}
      <span
        className="absolute right-0 h-2 w-2 -translate-x-1 -translate-y-1/2 rounded-full"
        style={{ top: `${(lastY / 110) * 100}%`, background: stroke, boxShadow: `0 0 10px ${stroke}` }}
      />

      <div className="absolute left-3 top-2.5 mono text-[9px] uppercase tracking-wider text-zinc-500">
        BTC · Perp
      </div>
    </div>
  );
}
