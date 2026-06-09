"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

type CoinCfg = { id: string; symbol: string; base: number };

function makeFallback(base: number) {
  const pts: number[] = [];
  let v = base;
  for (let i = 0; i < 48; i++) {
    v += Math.sin(i / 4) * (base * 0.005) + (i - 24) * (base * 0.0009);
    pts.push(Math.round(v * 100) / 100);
  }
  return pts;
}

export function PerpChart({ coin }: { coin: CoinCfg }) {
  const [points, setPoints] = useState<number[]>(() => makeFallback(coin.base));
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState(0);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const r = await fetch(`/api/chart?coin=${coin.id}`, { cache: "no-store" });
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
  }, [coin.id]);

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
  const gradId = `perpfill-${coin.symbol}`;
  const priceLabel =
    price != null
      ? `$${price.toLocaleString(undefined, { maximumFractionDigits: coin.base >= 1000 ? 0 : 2 })}`
      : "$—";

  return (
    <div className="relative h-28 overflow-hidden rounded-2xl border border-line bg-ink-950/60">
      <svg viewBox="0 0 400 110" className="h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={up ? "rgba(34,214,146,0.35)" : "rgba(248,113,113,0.3)"} />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>
        </defs>
        <motion.path d={area} fill={`url(#${gradId})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
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

      <div
        className="absolute inset-y-0 left-0 w-16 -skew-x-12 bg-gradient-to-r from-transparent via-white/8 to-transparent"
        style={{ animation: "sheen 3.5s ease-in-out infinite" }}
      />

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

      <span
        className="absolute right-0 h-2 w-2 -translate-x-1 -translate-y-1/2 rounded-full"
        style={{ top: `${(lastY / 110) * 100}%`, background: stroke, boxShadow: `0 0 10px ${stroke}` }}
      />

      <div className="absolute left-3 top-2.5 mono text-[9px] uppercase tracking-wider text-zinc-400">
        {coin.symbol} · Perp
      </div>
    </div>
  );
}
