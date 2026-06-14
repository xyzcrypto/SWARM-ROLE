"use client";

import { useEffect, useMemo, useState } from "react";

type CoinCfg = { id: string; symbol: string; base: number };
type Candle = number[]; // [open, high, low, close]

const TIMEFRAMES = [
  { d: 1, label: "1D" },
  { d: 7, label: "7D" },
  { d: 30, label: "1M" },
];

function makeFallback(base: number): Candle[] {
  const candles: Candle[] = [];
  let prev = base;
  for (let i = 0; i < 44; i++) {
    const drift = Math.sin(i / 5) * (base * 0.012) + (i - 22) * (base * 0.0011);
    const open = prev;
    const close = open + drift;
    const high = Math.max(open, close) + base * 0.005;
    const low = Math.min(open, close) - base * 0.005;
    candles.push([open, high, low, close]);
    prev = close;
  }
  return candles;
}

export function PerpChart({ coin }: { coin: CoinCfg }) {
  const [days, setDays] = useState(1);
  const [candles, setCandles] = useState<Candle[]>(() => makeFallback(coin.base));
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState(0);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const r = await fetch(`/api/chart?coin=${coin.id}&days=${days}`, { cache: "no-store" });
        if (!r.ok) throw new Error("bad");
        const d = await r.json();
        if (!active || !Array.isArray(d.candles) || d.candles.length < 2) return;
        setCandles(d.candles);
        setPrice(d.price);
        setChange(d.change);
        setLive(Boolean(d.live));
      } catch {
        if (active) setLive(false);
      }
    }
    load();
    // Don't poll while the tab is hidden - saves API calls/bandwidth; refresh
    // immediately when the user returns so the chart isn't stale.
    const t = setInterval(() => {
      if (!document.hidden) load();
    }, 60_000);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [coin.id, days]);

  const { min, range } = useMemo(() => {
    const highs = candles.map((c) => c[1]);
    const lows = candles.map((c) => c[2]);
    const mn = Math.min(...lows);
    const mx = Math.max(...highs);
    return { min: mn, range: mx - mn || 1 };
  }, [candles]);

  const yTop = (p: number) => ((1 - (p - min) / range) * 100).toFixed(2);
  const up = change >= 0;
  const priceLabel =
    price != null
      ? `$${price.toLocaleString(undefined, { maximumFractionDigits: coin.base >= 1000 ? 0 : 2 })}`
      : "$-";

  return (
    <div className="rounded-2xl border border-line bg-ink-950/60 p-3">
      {/* header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400 opacity-70" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${live ? "bg-mint-400" : "bg-amber-400"}`} />
          </span>
          <span className="mono text-[11px] font-semibold text-zinc-200">{coin.symbol}</span>
          <span className="mono text-[11px] text-zinc-400">{priceLabel}</span>
          <span className={`mono text-[10px] ${up ? "text-mint-300" : "text-red-300"}`}>
            {up ? "+" : ""}{change.toFixed(2)}%
          </span>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-line bg-ink-900/60 p-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.d}
              onClick={() => setDays(tf.d)}
              className={`rounded-md px-1.5 py-0.5 mono text-[9px] font-semibold transition-colors ${
                days === tf.d ? "bg-gold-500/20 text-gold-200" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* candlesticks */}
      <div className="relative flex h-24 items-stretch gap-px overflow-hidden">
        {candles.map((c, i) => {
          const [o, h, l, cl] = c;
          const gain = cl >= o;
          const color = gain ? "bg-mint-400" : "bg-red-400";
          const wickTop = yTop(h);
          const wickH = (((h - l) / range) * 100).toFixed(2);
          const bodyTop = yTop(Math.max(o, cl));
          const bodyH = Math.max(1.5, (Math.abs(o - cl) / range) * 100).toFixed(2);
          return (
            <div key={i} className="relative flex-1">
              <div className={`absolute left-1/2 w-px -translate-x-1/2 ${color} opacity-70`} style={{ top: `${wickTop}%`, height: `${wickH}%` }} />
              <div className={`absolute left-1/2 w-[70%] -translate-x-1/2 rounded-[1px] ${color}`} style={{ top: `${bodyTop}%`, height: `${bodyH}%` }} />
            </div>
          );
        })}
        {/* sweeping scan */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-16 -skew-x-12 bg-gradient-to-r from-transparent via-white/8 to-transparent"
          style={{ animation: "sheen 4s ease-in-out infinite" }}
        />
      </div>
    </div>
  );
}
