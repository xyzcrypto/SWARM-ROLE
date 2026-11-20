"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeftRight,
  BadgeCheck,
  Bitcoin,
  Blocks,
  BookOpen,
  CandlestickChart,
  Crown,
  EyeOff,
  FileCode2,
  Flame,
  Gem,
  GraduationCap,
  Landmark,
  Layers,
  ListChecks,
  Medal,
  Radio,
  ShieldCheck,
  Sparkles,
  Target,
  Telescope,
  Trophy,
  Vote,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Shared Academy primitives. Everything renders identically on the server and
// on the first client pass (no clock, storage or media query in render).

/** Icons a category or achievement may name. A closed map keeps lucide tree-shaken. */
export const ICONS: Record<string, LucideIcon> = {
  Blocks,
  Bitcoin,
  FileCode2,
  Landmark,
  ArrowLeftRight,
  CandlestickChart,
  ShieldCheck,
  Gem,
  Layers,
  Waypoints,
  Vote,
  Radio,
  EyeOff,
  Telescope,
  Sparkles,
  ListChecks,
  Medal,
  Target,
  Flame,
  Crown,
  Trophy,
  GraduationCap,
  BadgeCheck,
  BookOpen,
};

export function Icon({ name, className }: { name: string; className?: string }) {
  const I = ICONS[name] ?? BookOpen;
  return <I className={className} strokeWidth={1.7} aria-hidden />;
}

export function Avatar({ src, alt, size = 36, className }: { src: string | null; alt: string; size?: number; className?: string }) {
  const style = { width: size, height: size };
  if (!src)
    return (
      <span style={style} className={cn("grid shrink-0 place-items-center rounded-full bg-ink-700 text-xs font-bold uppercase text-content-muted", className)} aria-hidden>
        {alt.replace(/^@/, "").slice(0, 1)}
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} style={style} loading="lazy" referrerPolicy="no-referrer" className={cn("shrink-0 rounded-full object-cover", className)} />;
}

/** Animates from the previous value to `value`. */
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString("en-US"), duration = 900 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      setShown(a + (value - a) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className="tabular-nums">{format(shown)}</span>;
}

export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export function Panel({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn("surface min-w-0 rounded-3xl p-5 sm:p-6", className)}
    >
      {children}
    </motion.section>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mono text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-300/90", className)}>{children}</div>;
}

export function SectionTitle({ eyebrow, title, sub, right }: { eyebrow?: string; title: React.ReactNode; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-content sm:text-3xl">{title}</h2>
        {sub && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-content-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/** Thin gold progress bar with an animated fill. */
export function ProgressBar({ value, className, tone = "gold" }: { value: number; className?: string; tone?: "gold" | "mint" }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-white/[0.06]", className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className={cn("relative h-full rounded-full", tone === "gold" ? "bg-gradient-to-r from-gold-500 via-gold-300 to-gold-200" : "bg-gradient-to-r from-mint-500 to-mint-300")}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="acad-bar-sheen absolute inset-0 rounded-full" />
      </motion.div>
    </div>
  );
}

export function Stat({ label, value, sub, accent, icon }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-hairline bg-ink-900/40 px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-content-subtle">
        {icon}
        {label}
      </div>
      <div className={cn("mt-1.5 truncate font-display text-2xl font-bold tracking-tight", accent ? "text-gold-300" : "text-content")}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-content-subtle">{sub}</div>}
    </div>
  );
}

export function Empty({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-dashed border-hairline p-8 text-center text-sm leading-relaxed text-content-muted", className)}>{children}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-white/[0.05]", className)} />;
}

export const LEVEL_LABEL: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced", expert: "Expert" };
export const DIFF_LABEL: Record<string, string> = { easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert", mixed: "Mixed" };
export const DIFF_TONE: Record<string, string> = {
  easy: "border-mint-400/30 text-mint-300",
  medium: "border-sky-400/30 text-sky-300",
  hard: "border-gold-400/40 text-gold-300",
  expert: "border-gold-300/70 text-gold-200",
  beginner: "border-mint-400/30 text-mint-300",
  intermediate: "border-sky-400/30 text-sky-300",
  advanced: "border-gold-400/40 text-gold-300",
};

export function Pill({ children, tone, className }: { children: React.ReactNode; tone?: string; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", tone ?? "border-hairline text-content-muted", className)}>{children}</span>;
}

/** Rank movement arrow for leaderboards. */
export function Movement({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[11px] font-semibold text-sky-300">NEW</span>;
  if (value === 0) return <span className="text-[11px] text-content-subtle">=</span>;
  return value > 0 ? (
    <span className="text-[11px] font-semibold text-mint-300">▲{value}</span>
  ) : (
    <span className="text-[11px] font-semibold text-red-400">▼{Math.abs(value)}</span>
  );
}

/** Format a duration in ms as "1m 05s" / "12.4s". */
export function duration(ms: number) {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

/** UTC calendar date, pinned so server and client always agree (see CLAUDE.md). */
export function utcDate(iso: string | number) {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
}

/** Share text on X. */
export function shareOnX(text: string, url: string) {
  const u = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(u, "_blank", "noopener,noreferrer,width=600,height=520");
}

/** Lightweight confetti: DOM pieces with CSS animation, removed after. */
export function burstConfetti(origin?: { x: number; y: number }) {
  if (typeof document === "undefined") return;
  const host = document.createElement("div");
  host.className = "acad-confetti";
  host.style.left = `${origin?.x ?? window.innerWidth / 2}px`;
  host.style.top = `${origin?.y ?? window.innerHeight / 3}px`;
  const colors = ["#f3d488", "#e2a72f", "#fdf7e7", "#34e3a1", "#ffffff"];
  for (let i = 0; i < 70; i++) {
    const p = document.createElement("i");
    const angle = Math.random() * Math.PI * 2;
    const dist = 120 + Math.random() * 260;
    p.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    p.style.setProperty("--dy", `${Math.sin(angle) * dist - 120}px`);
    p.style.setProperty("--r", `${Math.random() * 720 - 360}deg`);
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = `${Math.random() * 120}ms`;
    host.appendChild(p);
  }
  document.body.appendChild(host);
  setTimeout(() => host.remove(), 2200);
}
