"use client";

/**
 * Smaller News features that sit around the feed. Kept out of NewsClient.tsx,
 * which is already the largest component in the module.
 *
 * Every one of these works from data the page already has (the loaded stories
 * and the shared /api/ticker poll), so none of them adds a request or a cost.
 */

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Gauge, Keyboard, Minus, TrendingDown, TrendingUp, X } from "lucide-react";
import { useTickerPoll, type TickerCoin } from "@/lib/useTickerPoll";
import { scrollPageToSmooth } from "@shared/hooks/useScrollLock";
import type { NewsItem } from "@/lib/news";
import { cn } from "@/lib/utils";

export type Mood = "all" | "bullish" | "bearish";

/* ─────────────────────────── Market mood ─────────────────────────── */

/** Bullish / neutral / bearish counts and a -100..100 lean. Exported for its test. */
export function moodOf(items: Pick<NewsItem, "sentiment">[]) {
  let bull = 0;
  let bear = 0;
  let neutral = 0;
  for (const i of items) {
    if (i.sentiment === "bullish") bull++;
    else if (i.sentiment === "bearish") bear++;
    else neutral++;
  }
  const total = bull + bear + neutral;
  const lean = total ? Math.round(((bull - bear) / total) * 100) : 0;
  const label = !total ? "No stories yet" : lean >= 15 ? "Leaning bullish" : lean <= -15 ? "Leaning bearish" : "Balanced";
  return { bull, bear, neutral, total, lean, label };
}

/**
 * How the loaded headlines lean, and a one-tap filter by sentiment. The
 * sentiment is the same keyword classification every card already shows; this
 * only counts it, so it is labelled as headline mood, not a market signal.
 */
export function MoodMeter({ items, active, onPick }: { items: NewsItem[]; active: Mood; onPick: (m: Mood) => void }) {
  const m = useMemo(() => moodOf(items), [items]);
  const pct = (n: number) => (m.total ? (n / m.total) * 100 : 0);
  // Needle position 0..100 across the bar (50 = balanced).
  const needle = 50 + m.lean / 2;
  const rows: { k: Mood | "neutral"; label: string; n: number; bar: string; text: string; icon: React.ReactNode }[] = [
    { k: "bullish", label: "Bullish", n: m.bull, bar: "bg-mint-400", text: "text-mint-300", icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { k: "neutral", label: "Neutral", n: m.neutral, bar: "bg-zinc-500", text: "text-content-muted", icon: <Minus className="h-3.5 w-3.5" /> },
    { k: "bearish", label: "Bearish", n: m.bear, bar: "bg-red-400", text: "text-red-300", icon: <TrendingDown className="h-3.5 w-3.5" /> },
  ];

  return (
    <section className="surface rounded-3xl p-5" aria-labelledby="news-mood">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="news-mood" className="flex items-center gap-2 font-display text-[0.9375rem] font-semibold text-content">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gold-500/10 text-gold-300">
            <Gauge className="h-4 w-4" />
          </span>
          Headline mood
        </h2>
        {active !== "all" && (
          <button onClick={() => onPick("all")} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[0.75rem] font-medium text-content-muted transition-colors hover:bg-surface-2 hover:text-content">
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {/* The lean, as a needle on a red-to-mint track. */}
      <div className="relative mb-1 h-2 rounded-full bg-gradient-to-r from-red-500/70 via-zinc-500/50 to-mint-400/80">
        <span
          aria-hidden
          className="absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-content shadow-[0_0_0_3px_rgba(0,0,0,0.35)] transition-[left] duration-700 ease-out"
          style={{ left: `${needle}%` }}
        />
      </div>
      <div className="mb-4 flex items-baseline justify-between text-[0.75rem]">
        <span className={cn("font-semibold", m.lean >= 15 ? "text-mint-300" : m.lean <= -15 ? "text-red-300" : "text-content-muted")}>{m.label}</span>
        <span className="text-content-subtle">{m.total} headline{m.total === 1 ? "" : "s"}</span>
      </div>

      <div className="space-y-1.5">
        {rows.map((r) => {
          const clickable = r.k !== "neutral";
          const on = active === r.k;
          const body = (
            <>
              <span className={cn("flex w-20 shrink-0 items-center gap-1.5 text-[0.78125rem] font-medium", r.text)}>
                {r.icon}
                {r.label}
              </span>
              <span className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                <span className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out", r.bar)} style={{ width: `${pct(r.n)}%` }} />
              </span>
              <span className="mono w-8 shrink-0 text-right text-[0.75rem] text-content-muted">{r.n}</span>
            </>
          );
          return clickable ? (
            <button
              key={r.k}
              onClick={() => onPick(on ? "all" : (r.k as Mood))}
              aria-pressed={on}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors",
                on ? "bg-surface-2 ring-1 ring-gold-500/40" : "hover:bg-surface-2"
              )}
            >
              {body}
            </button>
          ) : (
            <div key={r.k} className="flex items-center gap-3 px-2 py-1.5">
              {body}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[0.6875rem] leading-relaxed text-content-subtle">From the headlines loaded on this page. Tap Bullish or Bearish to filter the feed.</p>
    </section>
  );
}

/* ─────────────────────────── Token prices ─────────────────────────── */

/**
 * Live 24h change for the tokens a story mentions, from the shared ticker poll
 * (one request for the whole page, deduped across every consumer). A token the
 * ticker does not carry renders as the plain chip it always was.
 */
export function useTickerMap(): Map<string, TickerCoin> {
  const { coins } = useTickerPoll();
  return useMemo(() => new Map((coins ?? []).map((c) => [c.symbol.toUpperCase(), c])), [coins]);
}

export function TokenChip({ symbol, coin, onClick }: { symbol: string; coin?: TickerCoin; onClick: (t: string) => void }) {
  const ch = coin && Number.isFinite(coin.change) ? coin.change : null;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(symbol);
      }}
      title={coin ? `${coin.name}: $${coin.price.toLocaleString("en-US", { maximumFractionDigits: 6 })}` : undefined}
      className="mono inline-flex items-center gap-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-[0.625rem] text-content-muted transition-colors hover:bg-gold-500/15 hover:text-gold-300"
    >
      {symbol}
      {ch != null && (
        <span className={cn("font-semibold", ch > 0 ? "text-mint-400" : ch < 0 ? "text-red-400" : "text-content-subtle")}>
          {ch > 0 ? "+" : ""}
          {ch.toFixed(1)}%
        </span>
      )}
    </button>
  );
}

/* ─────────────────────────── Back to top ─────────────────────────── */

/**
 * Appears once the reader is well into the feed: a ring showing how far down
 * the page they are, and a tap back to the top. Position comes from scroll
 * events after mount, so nothing about it is rendered on the server.
 */
export function BackToTop({ threshold = 1200 }: { threshold?: number }) {
  const [state, setState] = useState({ show: false, progress: 0 });
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const y = window.scrollY;
        // Quantised, and a no-op when nothing visible changed: this used to
        // hand React a new object on every scroll frame, re-rendering the
        // component 60 times a second while reading.
        const show = y > threshold;
        const progress = max > 0 ? Math.round(Math.min(1, y / max) * 200) / 200 : 0;
        setState((prev) => (prev.show === show && prev.progress === progress ? prev : { show, progress }));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [threshold]);

  const r = 19;
  const c = 2 * Math.PI * r;
  return (
    <AnimatePresence>
      {state.show && (
        <motion.button
          key="news-top"
          initial={{ opacity: 0, y: 16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          // Through the scroll helper: Lenis rewrites the scroll position every frame,
          // so a bare window.scrollTo would be undone on the next tick.
          onClick={() => scrollPageToSmooth(0)}
          aria-label="Back to top"
          className="fixed bottom-24 left-4 z-40 grid h-12 w-12 place-items-center rounded-full border border-hairline bg-surface text-content shadow-elevate transition-colors hover:text-gold-300 sm:bottom-8 sm:left-6"
        >
          <svg aria-hidden viewBox="0 0 44 44" className="absolute inset-0 h-full w-full -rotate-90">
            <circle cx="22" cy="22" r={r} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="2.5" />
            <circle
              cx="22"
              cy="22"
              r={r}
              fill="none"
              stroke="#f5a524"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - state.progress)}
            />
          </svg>
          <ArrowUp className="relative h-4 w-4" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────────── Shortcuts ─────────────────────────── */

export const NEWS_SHORTCUTS: [string, string][] = [
  ["j / k", "Next / previous story"],
  ["o or Enter", "Open the highlighted story"],
  ["s", "Save or unsave it"],
  ["/", "Search"],
  ["1 / 2 / 3", "Latest / Top / Saved"],
  ["?", "Show these shortcuts"],
  ["Esc", "Close"],
];

export function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="news-keys"
          className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="news-keys-title"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border border-hairline bg-surface p-5 shadow-elevate"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="news-keys-title" className="flex items-center gap-2 font-display text-[0.9375rem] font-semibold text-content">
                <Keyboard className="h-4 w-4 text-gold-300" /> Keyboard shortcuts
              </h2>
              <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-content-muted hover:bg-surface-2 hover:text-content">
                <X className="h-4 w-4" />
              </button>
            </div>
            <dl className="space-y-2">
              {NEWS_SHORTCUTS.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 text-[0.8125rem]">
                  <dt className="text-content-muted">{v}</dt>
                  <dd>
                    <kbd className="rounded-md border border-hairline bg-surface-2 px-2 py-0.5 font-mono text-[0.71875rem] text-content">{k}</kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
