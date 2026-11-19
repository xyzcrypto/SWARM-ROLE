"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEVELS } from "@modules/creators/lib/game";

// Small shared pieces for /creators. Everything here renders the same on the
// server and the first client pass (no clock, no media query, no storage), so
// none of it can cause a hydration mismatch.

export function Avatar({ src, alt, size = 36, ring }: { src: string | null; alt: string; size?: number; ring?: string }) {
  const style = { width: size, height: size };
  if (!src) {
    return (
      <span
        style={style}
        className={cn("grid shrink-0 place-items-center rounded-full bg-ink-700 text-xs font-bold uppercase text-content-muted", ring)}
        aria-hidden
      >
        {alt.replace(/^@/, "").slice(0, 1)}
      </span>
    );
  }
  // Plain <img>: X / YouTube CDN images go browser -> CDN directly and cost
  // no Vercel transfer (cost-check trap 3).
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} style={style} loading="lazy" referrerPolicy="no-referrer" className={cn("shrink-0 rounded-full object-cover", ring)} />
  );
}

export function Chip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95",
        active
          ? "border-gold-400/60 bg-gold-400/15 text-gold-200 shadow-[0_0_18px_-6px_rgba(226,167,47,0.6)]"
          : "border-hairline text-content-muted hover:border-gold-400/30 hover:text-content"
      )}
    >
      {children}
    </button>
  );
}

export function SearchBox({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <label className={cn("relative block w-full sm:max-w-xs", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-xl border border-hairline bg-ink-900/60 py-2 pl-9 pr-3 text-sm text-content placeholder:text-content-subtle transition-colors focus:border-gold-400/50 focus:outline-none"
      />
    </label>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-hairline p-8 text-center text-sm leading-relaxed text-content-muted">{children}</div>;
}

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn("surface min-w-0 rounded-3xl p-4 sm:p-6", className)}
    >
      {children}
    </motion.section>
  );
}

export function PanelTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight text-content">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-content-subtle">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/** Animates from the previous value to `value`. Starts at 0 only on first mount. */
export function CountUp({ value, format, duration = 900 }: { value: number; format: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(a + (value - a) * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className="tabular-nums">{format(shown)}</span>;
}

export function Stat({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-hairline bg-ink-900/40 px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-subtle">{label}</div>
      <div className={cn("mt-1 font-display text-xl font-bold tracking-tight", accent ? "text-gold-300" : "text-content")}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-content-subtle">{sub}</div>}
    </div>
  );
}

const LEVEL_TONES = [
  "border-hairline text-content-muted",
  "border-sky-400/30 text-sky-300",
  "border-sky-400/40 text-sky-200",
  "border-mint-400/30 text-mint-300",
  "border-mint-400/50 text-mint-200",
  "border-gold-400/40 text-gold-300",
  "border-gold-400/60 text-gold-200",
  "border-gold-300/80 text-gold-100 shadow-[0_0_14px_-4px_rgba(235,189,82,0.7)]",
];

export function LevelChip({ n, compact }: { n: number; compact?: boolean }) {
  const l = LEVELS[n - 1] ?? LEVELS[0]!;
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", LEVEL_TONES[n - 1])}>
      L{l.n}
      {!compact && <span className="font-semibold normal-case tracking-normal">{l.name}</span>}
    </span>
  );
}

/** XYZ Score as a ring (0-1000). */
export function ScoreRing({ value, size = 92 }: { value: number; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const k = Math.max(0, Math.min(1, value / 1000));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={6} className="text-ink-700" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#xyzScoreGrad)"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - k) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
        <defs>
          <linearGradient id="xyzScoreGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ebbd52" />
            <stop offset="100%" stopColor="#22d692" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-xl font-bold leading-none text-content">
            <CountUp value={value} format={(n) => String(Math.round(n))} />
          </div>
          <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-content-subtle">XYZ Score</div>
        </div>
      </div>
    </div>
  );
}

export function Bar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-ink-700", className)}>
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-gold-400 to-mint-400"
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

/** Tiny bar chart. Values only; labels go in `titles` for hover. */
export function Sparkbars({ values, titles, height = 56 }: { values: number[]; titles?: string[]; height?: number }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {values.map((v, i) => (
        <motion.div
          key={i}
          title={titles?.[i]}
          className="flex-1 rounded-t bg-gradient-to-t from-gold-500/50 to-gold-300"
          initial={{ height: 0 }}
          animate={{ height: `${Math.max(v > 0 ? 6 : 2, (v / max) * 100)}%` }}
          transition={{ duration: 0.6, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
          style={{ opacity: v > 0 ? 1 : 0.25 }}
        />
      ))}
    </div>
  );
}

export function RankMark({ rank }: { rank: number }) {
  if (rank <= 3) {
    const tone = ["from-gold-200 to-gold-500 text-ink-900", "from-zinc-100 to-zinc-400 text-ink-900", "from-amber-500 to-amber-800 text-white"][rank - 1];
    return (
      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br text-xs font-black shadow-lg", tone)}>{rank}</span>
    );
  }
  return <span className="w-7 shrink-0 text-center font-display text-sm font-bold tabular-nums text-content-subtle">{rank}</span>;
}

/**
 * A small list kept in this browser only (watchlist, recent scans, game
 * bests). Read after mount - never during render - so the server HTML and the
 * first client render always match; storage being blocked just means an
 * empty list.
 */
export function useLocalList(key: string, max = 50): [string[], (next: string[]) => void] {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const v = JSON.parse(localStorage.getItem(key) || "[]");
        if (Array.isArray(v)) setList(v.filter((x) => typeof x === "string").slice(0, max));
      } catch {
        /* blocked or corrupt: start empty */
      }
    }, 0);
    return () => clearTimeout(t);
  }, [key, max]);
  const save = (next: string[]) => {
    const trimmed = next.slice(0, max);
    setList(trimmed);
    try {
      localStorage.setItem(key, JSON.stringify(trimmed));
    } catch {
      /* not remembered, still works for this visit */
    }
  };
  return [list, save];
}

/** Thin refresh bar shown while new data replaces data already on screen. */
export function Refreshing({ on }: { on: boolean }) {
  return (
    <div className="pointer-events-none h-0.5 w-full overflow-hidden rounded-full" aria-hidden>
      {on && (
        <motion.div
          className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-gold-300 to-transparent"
          initial={{ x: "-100%" }}
          animate={{ x: "300%" }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}

/** Hour or weekday heat strip. */
export function HeatStrip({ values, labels, title }: { values: number[]; labels: string[]; title: (i: number) => string }) {
  const max = Math.max(1, ...values);
  return (
    <div>
      <div className="flex gap-0.5">
        {values.map((v, i) => (
          <div
            key={i}
            title={title(i)}
            className="h-7 flex-1 rounded-[3px] bg-gold-400"
            style={{ opacity: v > 0 ? 0.15 + 0.85 * (v / max) : 0.06 }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-content-subtle">
        {labels.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
    </div>
  );
}
