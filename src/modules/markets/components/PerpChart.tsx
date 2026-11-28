"use client";

import { useCallback, useMemo, useState } from "react";
import { useLiveData } from "@shared/hooks/useLiveData";

type CoinCfg = { id: string; symbol: string; base: number };
type Candle = number[]; // [open, high, low, close]

const TIMEFRAMES = [
  { d: 1, label: "1D" },
  { d: 7, label: "7D" },
  { d: 30, label: "1M" },
];

/**
 * ⚠️ This component used to seed itself with 44 INVENTED candles.
 *
 * `makeFallback(coin.base)` walked a sine wave out from a hardcoded price -
 * 64000 for BTC, 3400 for ETH, both written into the JSX at the call site and
 * both years out of date - and that shape was what rendered on first paint and
 * for as long as `/api/chart` was unreachable. It is a candlestick chart: green
 * and red bodies, wicks, a plausible trend. Nothing about it looks generated.
 *
 * The only tells were an amber dot instead of a green one and a price reading
 * "$-", against a chart drawing what appeared to be real price action. On a
 * page whose entire job is telling people what the market is doing, that is the
 * worst thing this file could render.
 *
 * There is no honest fallback for a price chart. When there is no data, say so.
 */
type Snapshot = {
  key: string;
  candles: Candle[];
  price: number | null;
  change: number;
  live: boolean;
};

export function PerpChart({ coin }: { coin: CoinCfg }) {
  const [days, setDays] = useState(1);
  // Keyed by `coin:days` rather than cleared in a second effect. Switching
  // timeframe used to leave the previous timeframe's candles on screen under
  // the new label until the request came back; a stale snapshot now simply
  // stops matching and is not read.
  const key = `${coin.id}:${days}`;
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const data = snap?.key === key ? snap : null;
  const failed = failedKey === key;

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/chart?coin=${coin.id}&days=${days}`, { cache: "no-store" });
      if (!r.ok) throw new Error("bad");
      const d = await r.json();
      // Fewer than two candles cannot be drawn, so it is a failure - not a
      // reason to return early and leave whatever was there before on screen.
      if (!Array.isArray(d.candles) || d.candles.length < 2) throw new Error("empty");
      setSnap({ key, candles: d.candles, price: d.price, change: d.change, live: Boolean(d.live) });
      setFailedKey(null);
    } catch (e) {
      setFailedKey(key);
      throw e; // retry with backoff rather than waiting out the minute
    }
  }, [coin.id, days, key]);

  // Pauses while hidden, retries a failure in ~1s, and only refetches on return
  // to the tab once the minute has actually elapsed - two of these render on
  // /markets and two more on the homepage.
  useLiveData({ load, intervalMs: 60_000, wakeMinAgeMs: 60_000 });

  const candles = data?.candles ?? null;
  const change = data?.change ?? 0;
  const live = data?.live ?? false;

  const { min, range } = useMemo(() => {
    if (!candles?.length) return { min: 0, range: 1 };
    const highs = candles.map((c) => c[1]);
    const lows = candles.map((c) => c[2]);
    const mn = Math.min(...lows);
    const mx = Math.max(...highs);
    return { min: mn, range: mx - mn || 1 };
  }, [candles]);

  const yTop = (p: number) => ((1 - (p - min) / range) * 100).toFixed(2);
  const up = change >= 0;
  const priceLabel =
    data?.price != null
      ? `$${data.price.toLocaleString("en-US", { maximumFractionDigits: coin.base >= 1000 ? 0 : 2 })}`
      : "$-";

  return (
    <div className="neu-card rounded-2xl border border-white/60 dark:border-white/[0.06] shadow-neu p-3">
      {/* header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />}
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                live ? "bg-emerald-400" : failed ? "bg-amber-400" : "animate-pulse bg-zinc-500"
              }`}
            />
          </span>
          <span className="mono text-[0.6875rem] font-semibold text-zinc-900 dark:text-zinc-200">{coin.symbol}</span>
          <span className="mono text-[0.6875rem] text-zinc-600 dark:text-zinc-400">{priceLabel}</span>
          {data && (
            <span className={`mono text-[0.625rem] ${up ? "text-emerald-600 dark:text-mint-300" : "text-rose-600 dark:text-red-300"}`}>
              {up ? "+" : ""}{change.toFixed(2)}%
            </span>
          )}
        </div>
        <div className="neu-inset-sm flex items-center gap-0.5 rounded-xl border border-white/60 dark:border-white/[0.04] p-0.5 shadow-neu-inset-sm">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.d}
              onClick={() => setDays(tf.d)}
              // Measured at 23x18px on every touch viewport - the smallest tap
              // target on the site. `tap-target-y` grows only the *hit* area,
              // vertically, via a pseudo-element; the pill's own box, padding
              // and font size are untouched so the control looks identical.
              // Vertical only on purpose: these three sit 2px apart, so
              // expanding sideways would make neighbouring hit areas overlap
              // and steal each other's taps.
              className={`tap-target-y rounded-md px-1.5 py-0.5 mono text-[0.5625rem] font-semibold transition-colors ${
                days === tf.d ? "neu-inset bg-amber-400/25 text-amber-800 dark:text-amber-200 border border-amber-400/50 shadow-neu-inset-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* candlesticks - or an honest empty frame, never invented ones */}
      {!candles ? (
        <div className="relative flex h-24 items-center justify-center overflow-hidden rounded-lg bg-white/[0.02]">
          {/* A flat baseline reads as "no data" the way a drawn trend never
              could, and holds the same height so the card doesn't jump. */}
          <div className="absolute inset-x-3 top-1/2 h-px bg-white/10" />
          <span className="relative mono text-[0.625rem] text-zinc-500">
            {failed ? "Chart unavailable" : "Loading chart…"}
          </span>
        </div>
      ) : (
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
      )}
    </div>
  );
}
