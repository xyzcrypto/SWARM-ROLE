"use client";

/**
 * The static and sidebar pieces of the redesigned /news page.
 *
 * Everything here renders REAL data or nothing. The page used to be a header
 * and a feed; the redesign adds a hero, discovery sidebar, research and XYZ AI
 * sections, and each one is fed by something that already exists:
 *
 * - source count: `NEWS_SOURCES` (the feeds we actually aggregate)
 * - refresh cadence: `NEWS_REVALIDATE` (the real feed cache window)
 * - trending topics: counted from the stories currently loaded, never invented
 * - newsletter: `/api/subscribe`, success shown only on a 2xx
 * - community: the official links in `site.ts`
 *
 * There is deliberately no market-price widget and no events list: /news has no
 * events source, and a list we cannot keep current would show expired events as
 * upcoming. `news-redesign.test.ts` pins both absences.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bookmark, BookmarkCheck, Check, Flame, Loader2, Mail, Share2, Sparkles, Star, Users, X, Zap } from "lucide-react";
import { useScrollLock } from "@shared/hooks/useScrollLock";
import { AnimatePresence, motion } from "framer-motion";
import { isNewsletterSubscribed, markNewsletterSubscribed } from "@shared/hooks/useNewsletterSubscribed";
import { MagicStar } from "iconsax-react";
import { hapticError, hapticSent, hapticToggle } from "@shared/utils/haptics";
import { timeAgo } from "@/lib/news";
import { TelegramIcon, XIcon, YouTubeIcon, LinkedInIcon } from "@/components/BrandIcons";
import { XYZ_AI_OPEN_EVENT } from "@modules/ai/lib/events";
import { RobotIcon } from "@/components/RobotIcon";
import { NEWS_SOURCES } from "@modules/news/lib/news-sources";
import type { NewsItem } from "@/lib/news";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { photoFallback, photoSrc } from "@shared/utils/img";

const openXyzAi = () => window.dispatchEvent(new Event(XYZ_AI_OPEN_EVENT));

/** Section header shared by every block on the page, so they all line up. */
export function SectionHead({ icon, title, action, id }: { icon?: React.ReactNode; title: string; action?: React.ReactNode; id?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 id={id} className="flex items-center gap-2 font-display text-[17px] font-semibold tracking-tight text-content sm:text-lg">
        {icon && <span className="text-gold-400">{icon}</span>}
        {title}
      </h2>
      {action}
    </div>
  );
}

/**
 * Left half of the hero. Server-rendered and visible without JavaScript: the
 * old `PageHeader` shipped its <h1> at opacity 0 until framer-motion hydrated
 * (audit SEO6). The entrance here is the CSS `hero-rise` pattern instead.
 */
export function NewsHeroIntro({ onExplore, live }: { onExplore: () => void; live: boolean }) {
  return (
    <div className="relative flex min-w-0 flex-col justify-center gap-3 p-5 sm:gap-4 sm:p-8">
      {/* The homepage's "The Home Of Next Gen Web3" pill: same glass, same
          gold shine sweep (`.eyebrow-glass`), so the two heroes read as one brand. */}
      <div className="hero-rise" style={{ "--rise-y": "12px", "--rise-dur": "0.5s" } as React.CSSProperties}>
        <span className="eyebrow eyebrow-glass text-zinc-200">
          <MagicStar size={14} variant="Bold" color="#e2a72f" />
          <span className="mono text-[10px] uppercase tracking-[0.08em] sm:text-[11px] sm:tracking-[0.16em]">Live Web3 Intelligence</span>
          <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", live ? "animate-pulse bg-mint-400" : "bg-gold-400")} />
        </span>
      </div>
      <h1 className="hero-rise font-display text-[34px] font-bold leading-none tracking-[-0.035em] text-content sm:text-[52px]">
        <span>Web3 </span>
        <span className="text-shine">News</span>
      </h1>
      <p className="hero-rise max-w-md text-[14px] leading-relaxed text-content-muted sm:text-[15px]">
        The signal behind the noise. Real-time crypto news, research, and insights that move Web3 forward.
      </p>
      <div className="hero-rise flex flex-nowrap gap-2.5">
        <button type="button" onClick={onExplore} className="btn-gold whitespace-nowrap px-4 py-2 text-[13px] sm:text-[13.5px]">
          Explore News <ArrowRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={openXyzAi} className="btn-ghost whitespace-nowrap px-4 py-2 text-[13px] sm:text-[13.5px]">
          <RobotIcon className="h-4 w-4" /> Open XYZ AI
        </button>
      </div>
      <p className="hero-rise flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-content-subtle sm:text-[12px]">
        <span><b className="font-mono font-semibold text-content">{NEWS_SOURCES.length}</b> trusted sources</span>
        <span><b className="font-mono font-semibold text-content">2 min</b> refresh</span>
        <span><b className="font-semibold text-content">AI</b> summaries</span>
      </p>
    </div>
  );
}

/**
 * A restrained gold network behind the hero: a handful of hairlines,
 * static, drawn once. No animation loop, no blur orbs.
 */
export function HeroNetwork() {
  const nodes: [number, number][] = [[8, 22], [22, 70], [36, 34], [52, 82], [64, 18], [78, 56], [92, 30], [96, 84]];
  const links: [number, number][] = [[0, 2], [1, 2], [2, 4], [1, 3], [3, 5], [4, 6], [5, 6], [5, 7], [2, 5]];
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.55]" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="news-net" x1="0" x2="1">
          <stop offset="0" stopColor="#e2a72f" stopOpacity="0" />
          <stop offset="0.5" stopColor="#e2a72f" stopOpacity="0.35" />
          <stop offset="1" stopColor="#e2a72f" stopOpacity="0" />
        </linearGradient>
      </defs>
      {links.map(([a, b], i) => (
        <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke="url(#news-net)" strokeWidth="0.15" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

/** A thumbnail that disappears cleanly when the image fails. */
function Thumb({ src, className }: { src: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={cn("relative block overflow-hidden bg-gradient-to-br from-gold-500/20 via-ink-900 to-ink-950", className)}>
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoSrc(src, 240) ?? src} data-orig={src} alt="" loading="lazy" decoding="async" onError={photoFallback(() => setFailed(true))} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06] group-active:scale-[1.06]" />
      )}
    </span>
  );
}

const SIX_H = 6 * 3600e3;

type TopicStat = { name: string; count: number; recent: number; bull: number; bear: number; latest: number };

/**
 * Trending topics, computed entirely from the stories loaded right now:
 * how many stories mention each topic, how many of those landed in the last
 * six hours (momentum), and the bullish / bearish mix. Nothing is estimated.
 */
export function TrendingTopics({
  items, now, active, onPick, onClear, followed, onFollow, limit = 7, onSeeAll, bare = false,
}: {
  items: NewsItem[]; now: number; active: string; onPick: (c: string) => void; onClear: () => void;
  /** Topics the member follows for "For You"; null when logged out (no follow control). */
  followed: string[] | null; onFollow: (c: string) => void;
  /** How many topics to rank. The sidebar shows 7; "See all" shows the lot. */
  limit?: number; onSeeAll?: () => void;
  /** Inside a sheet: no card chrome of its own. */
  bare?: boolean;
}) {
  const [range, setRange] = useState<"all" | "6h">("all");
  const stats = useMemo(() => {
    const m = new Map<string, TopicStat>();
    for (const i of items) {
      const fresh = now > 0 && now - i.publishedAt <= SIX_H;
      for (const c of i.categories) {
        const t = m.get(c) ?? { name: c, count: 0, recent: 0, bull: 0, bear: 0, latest: 0 };
        t.count += 1;
        if (fresh) t.recent += 1;
        if (i.sentiment === "bullish") t.bull += 1;
        if (i.sentiment === "bearish") t.bear += 1;
        t.latest = Math.max(t.latest, i.publishedAt);
        m.set(c, t);
      }
    }
    const all = [...m.values()];
    const key = (t: TopicStat) => (range === "6h" ? t.recent : t.count);
    return all.filter((t) => key(t) > 0).sort((a, b) => key(b) - key(a) || b.latest - a.latest).slice(0, limit);
  }, [items, now, range, limit]);
  const max = Math.max(1, ...stats.map((t) => (range === "6h" ? t.recent : t.count)));

  return (
    <section className={cn(!bare && "surface rounded-3xl p-5")} aria-labelledby={bare ? undefined : "news-trending"}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={bare ? undefined : "news-trending"} className={cn("flex items-center gap-2 font-display text-[17px] font-semibold tracking-tight text-content", bare && "sr-only")}>
          <Flame className="h-4 w-4 text-gold-400" /> Trending topics
        </h2>
        <div role="radiogroup" aria-label="Trending window" className="inline-flex rounded-lg border border-hairline bg-surface-2 p-0.5">
          {(["all", "6h"] as const).map((r) => (
            <button
              key={r}
              role="radio"
              aria-checked={range === r}
              onClick={() => setRange(r)}
              className={cn("rounded-md px-2 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-wider transition-colors", range === r ? "bg-gold-400 text-ink" : "text-content-subtle hover:text-content")}
            >
              {r === "all" ? "Feed" : "6h"}
            </button>
          ))}
        </div>
      </div>

      {stats.length === 0 ? (
        <p className="rounded-xl border border-dashed border-hairline px-3 py-6 text-center text-[13px] text-content-muted">
          {range === "6h" ? "Nothing new in the last six hours." : "Topics appear once stories load."}
        </p>
      ) : (
        <ol className="grid gap-1.5">
          {stats.map((t, i) => {
            const n = range === "6h" ? t.recent : t.count;
            const on = active === t.name;
            const rising = t.recent >= 2 && t.recent * 2 > t.count;
            const isFollowed = followed?.includes(t.name) ?? false;
            const bullPct = (t.bull / t.count) * 100, bearPct = (t.bear / t.count) * 100;
            return (
              <li key={t.name} className="group relative">
                <button
                  type="button"
                  onClick={() => (on ? onClear() : onPick(t.name))}
                  aria-pressed={on}
                  className={cn(
                    "relative flex w-full items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all active:scale-[0.99]",
                    on ? "border-gold-500/50 bg-gold-500/10" : "border-transparent hover:border-hairline hover:bg-surface-2",
                    followed && "pr-11"
                  )}
                >
                  {/* share-of-feed bar behind the row */}
                  <span aria-hidden className="absolute inset-y-0 left-0 bg-gold-500/[0.05] transition-[width] duration-500" style={{ width: `${(n / max) * 100}%` }} />
                  <span className="relative w-4 font-mono text-[11px] tabular-nums text-content-subtle">{i + 1}</span>
                  <span className="relative min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className={cn("truncate text-[13.5px] font-semibold", on ? "text-gold-300" : "text-content")}>{t.name}</span>
                      {rising && <span className="shrink-0 rounded bg-gold-400/15 px-1 py-px font-mono text-[9.5px] font-bold uppercase tracking-wider text-gold-300">Rising</span>}
                    </span>
                    {/* bullish / bearish mix */}
                    <span className="mt-1.5 flex h-1 w-full overflow-hidden rounded-full bg-hairline" title={`${t.bull} bullish · ${t.bear} bearish · ${t.count - t.bull - t.bear} neutral`}>
                      <span className="h-full bg-mint-400/80" style={{ width: `${bullPct}%` }} />
                      <span className="h-full bg-red-400/80" style={{ width: `${bearPct}%` }} />
                    </span>
                  </span>
                  <span className="relative text-right">
                    <span className="block font-mono text-[13px] font-semibold tabular-nums text-content">{n}</span>
                    <span className="block text-[10.5px] text-content-subtle">{n === 1 ? "story" : "stories"}</span>
                  </span>
                </button>
                {followed && (
                  <button
                    type="button"
                    onClick={() => { hapticToggle(); onFollow(t.name); }}
                    aria-pressed={isFollowed}
                    aria-label={isFollowed ? `Unfollow ${t.name}` : `Follow ${t.name} in For You`}
                    title={isFollowed ? "Following in For You" : "Follow in For You"}
                    className={cn("absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg transition-colors hover:bg-surface", isFollowed ? "text-gold-400" : "text-content-subtle hover:text-content")}
                  >
                    <Star className={cn("h-3.5 w-3.5", isFollowed && "fill-current")} />
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-content-subtle">
        <span className="inline-flex items-center gap-3">
          <span className="inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-mint-400" /> Bullish</span>
          <span className="inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-red-400" /> Bearish</span>
        </span>
        <span>From {items.length} loaded stories</span>
      </div>
      {onSeeAll && (
        <button type="button" onClick={onSeeAll} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-hairline py-2 text-[12.5px] font-semibold text-gold-300 transition-colors hover:border-gold-500/40">
          See all topics <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
      {active !== "All" && active !== "For You" && (
        <button type="button" onClick={onClear} className="mt-3 w-full rounded-xl border border-hairline py-2 text-[12.5px] font-medium text-content-muted transition-colors hover:text-content">
          Clear topic filter
        </button>
      )}
    </section>
  );
}

const TWO_H = 2 * 3600e3;

/**
 * The most important stories not already on screen, ranked by the feed's own
 * impact field, then recency. Read stories are dimmed so the panel always
 * points at what is left to read.
 */
export function HighImpactPanel({
  items, now, readIds, isSaved, onOpen, onBookmark, onShare, limit = 5, onSeeAll, bare = false,
}: {
  items: NewsItem[]; now: number; readIds: Set<string>; isSaved: (id: string) => boolean;
  onOpen: (id: string) => void; onBookmark: (i: NewsItem) => void; onShare: (i: NewsItem) => void;
  limit?: number; onSeeAll?: () => void; bare?: boolean;
}) {
  const [onlyHigh, setOnlyHigh] = useState(false);
  const list = useMemo(() => {
    const rank = (i: NewsItem) => (i.impact === "High" ? 2 : i.impact === "Medium" ? 1 : 0);
    return items
      .filter((i) => (onlyHigh ? i.impact === "High" : i.impact !== "Low"))
      .sort((a, b) => rank(b) - rank(a) || b.publishedAt - a.publishedAt)
      .slice(0, limit);
  }, [items, onlyHigh, limit]);
  const unread = list.filter((i) => !readIds.has(i.id)).length;

  return (
    <section className={cn(!bare && "surface rounded-3xl p-5")} aria-labelledby={bare ? undefined : "news-impact"}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id={bare ? undefined : "news-impact"} className={cn("flex items-center gap-2 whitespace-nowrap font-display text-[17px] font-semibold tracking-tight text-content", bare && "sr-only")}>
            <Zap className="h-4 w-4 text-gold-400" /> High impact
          </h2>
          <p className="mt-0.5 text-[11.5px] text-content-subtle">{unread > 0 ? `${unread} unread · ranked by impact` : "All caught up"}</p>
        </div>
        <div role="radiogroup" aria-label="Impact level" className="inline-flex rounded-lg border border-hairline bg-surface-2 p-0.5">
          {([false, true] as const).map((h) => (
            <button
              key={String(h)}
              role="radio"
              aria-checked={onlyHigh === h}
              onClick={() => setOnlyHigh(h)}
              className={cn("rounded-md px-2 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-wider transition-colors", onlyHigh === h ? "bg-gold-400 text-ink" : "text-content-subtle hover:text-content")}
            >
              {h ? "High" : "All"}
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-hairline px-3 py-6 text-center text-[13px] text-content-muted">No high-impact stories right now.</p>
      ) : (
        <ol className="grid gap-1">
          {list.map((item, i) => {
            const read = readIds.has(item.id);
            const fresh = now > 0 && item.impact === "High" && now - item.publishedAt < TWO_H;
            const saved = isSaved(item.id);
            return (
              <li key={item.id} className={cn("group relative flex gap-3 rounded-xl p-2 transition-colors hover:bg-surface-2", read && "opacity-60")}>
                <button type="button" onClick={() => onOpen(item.id)} className="absolute inset-0 rounded-xl" aria-label={`Read: ${item.title}`} />
                <div className="relative shrink-0">
                  <Thumb src={item.image} className="h-14 w-16 rounded-lg" />
                  <span className="absolute -left-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-hairline bg-surface font-mono text-[10px] font-bold text-content">{i + 1}</span>
                </div>
                <div className="pointer-events-none relative min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("rounded px-1 py-px font-mono text-[9.5px] font-bold uppercase tracking-wider", item.impact === "High" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400")}>
                      {item.impact}
                    </span>
                    {fresh && (
                      <span className="inline-flex items-center gap-1 font-mono text-[9.5px] font-bold uppercase tracking-wider text-red-400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> Live
                      </span>
                    )}
                    {read && <span className="inline-flex items-center gap-0.5 text-[10.5px] text-content-subtle"><Check className="h-3 w-3" /> Read</span>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug text-content group-hover:text-gold-200">{item.title}</p>
                  <p className="mt-0.5 truncate text-[11.5px] text-content-subtle">
                    <span className={cn(item.sentiment === "bullish" ? "text-mint-400" : item.sentiment === "bearish" ? "text-red-400" : "")}>●</span> {item.source}{now ? ` · ${timeAgo(item.publishedAt, now)}` : ""}
                  </p>
                </div>
                <div className="relative flex shrink-0 flex-col gap-0.5">
                  <button type="button" onClick={() => onBookmark(item)} aria-pressed={saved} aria-label={saved ? "Remove bookmark" : "Bookmark"} className={cn("grid h-7 w-7 place-items-center rounded-lg transition-colors hover:bg-surface", saved ? "text-gold-400" : "text-content-subtle hover:text-content")}>
                    {saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => onShare(item)} aria-label="Share" className="grid h-7 w-7 place-items-center rounded-lg text-content-subtle transition-colors hover:bg-surface hover:text-content">
                    <Share2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {onSeeAll && list.length > 0 && (
        <button type="button" onClick={onSeeAll} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-hairline py-2 text-[12.5px] font-semibold text-gold-300 transition-colors hover:border-gold-500/40">
          See all high-impact stories <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </section>
  );
}

/**
 * A full-height sheet for "See all". Bottom sheet on phones, centred panel on
 * desktop; Esc and the backdrop close it, and the page behind stops scrolling.
 */
export function NewsSheet({ title, icon, onClose, children }: { title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  useScrollLock();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="hero-rise flex max-h-[88svh] w-full flex-col overflow-hidden rounded-t-3xl border border-hairline bg-surface shadow-2xl sm:max-w-lg sm:rounded-3xl"
        style={{ ["--rise-y" as string]: "24px", ["--rise-dur" as string]: "0.35s" }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
          <p className="flex items-center gap-2 font-display text-[17px] font-semibold text-content"><span className="text-gold-400">{icon}</span>{title}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-xl text-content-muted transition-colors hover:bg-surface-2 hover:text-content">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div data-lenis-prevent className="overflow-y-auto overscroll-contain p-5">{children}</div>
      </div>
    </div>
  );
}

/** The high-impact mark, shared so the sheet header matches the panel. */
export const ImpactIcon = Zap;

/** Sidebar switcher: one of Trending / High impact at a time, so each shows in full. */
export function DiscoverSwitch({ value, onChange }: { value: "trending" | "impact"; onChange: (v: "trending" | "impact") => void }) {
  return (
    <div role="tablist" aria-label="Discover" className="grid grid-cols-2 gap-1 rounded-2xl border border-hairline bg-surface p-1">
      {([["trending", "Trending", <Flame key="f" className="h-4 w-4" />], ["impact", "High impact", <Zap key="z" className="h-4 w-4" />]] as const).map(([k, label, icon]) => (
        <button
          key={k}
          role="tab"
          aria-selected={value === k}
          onClick={() => onChange(k)}
          className={cn(
            "inline-flex h-10 items-center justify-center gap-2 rounded-xl text-[13.5px] font-semibold transition-all active:scale-[0.98]",
            value === k ? "bg-gold-400 text-ink shadow-gold-sm" : "text-content-muted hover:text-content"
          )}
        >
          {icon}{label}
        </button>
      ))}
    </div>
  );
}

/** XYZ AI band. Only advertises what exists: story summaries, "why this matters", and the assistant. */
export function XyzAiBand() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-gold-500/25 bg-surface p-6 sm:p-8" aria-labelledby="news-ai">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gold-500/15 blur-3xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-gold-500/30 bg-gold-500/10 text-gold-300">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="news-ai" className="font-display text-xl font-semibold tracking-tight text-content sm:text-2xl">Go beyond the headlines.</h2>
            <p className="mt-1 max-w-xl text-[14px] leading-relaxed text-content-muted">
              Understand the story, explore the narrative, and discover the bigger picture with XYZ AI. Summaries and context on every story, and an assistant for the questions that follow.
            </p>
          </div>
        </div>
        <button type="button" onClick={openXyzAi} className="btn-gold shrink-0 px-5 py-2.5 text-sm">
          Explore XYZ AI <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

/**
 * Newsletter capture. Success is shown only when `/api/subscribe` returns 2xx.
 *
 * Once this browser has subscribed the card stops asking: a fresh subscribe
 * shows its confirmation briefly, then the card folds away, and later visits
 * do not render it at all (decided in an effect after mount, so the server
 * HTML and the hydration pass match).
 */
const NEWSLETTER_DONE_MS = 2200;

export function NewsletterPanel() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { if (isNewsletterSubscribed()) setGone(true); }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (state !== "done") return;
    const t = setTimeout(() => setGone(true), NEWSLETTER_DONE_MS);
    return () => clearTimeout(t);
  }, [state]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setState("error"); setMsg("Enter a valid email address."); return; }
    setState("loading"); setMsg("");
    try {
      const res = await fetch("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), source: "news" }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setState("error"); setMsg(j?.error || "Could not subscribe. Please try again."); hapticError(); return; }
      setState("done");
      markNewsletterSubscribed();
      hapticSent();
    } catch {
      setState("error"); setMsg("Network error. Please try again.");
    }
  }
  return (
    <AnimatePresence initial={false}>
      {!gone && (
        <motion.section
          key="news-letter"
          exit={{ opacity: 0, height: 0, marginTop: 0, scale: 0.97 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="surface overflow-hidden rounded-3xl p-5"
          aria-labelledby="news-letter"
        >
          <SectionHead id="news-letter" icon={<Mail className="h-4 w-4" />} title="Newsletter" />
          <p className="-mt-2 mb-4 text-[13px] leading-relaxed text-content-muted">The day&apos;s top Web3 news and research, in your inbox.</p>
          {state === "done" ? (
            <motion.p
              role="status"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-xl border border-gold-500/30 bg-gold-500/10 px-3 py-2.5 text-[13px] font-medium text-gold-200"
            >
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}>
                <Check className="h-4 w-4" strokeWidth={3} />
              </motion.span>
              You&apos;re subscribed. See you in your inbox.
            </motion.p>
          ) : (
            <form onSubmit={submit} noValidate className="flex gap-2">
              <label htmlFor="news-letter-email" className="sr-only">Email address</label>
              <input
                id="news-letter-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (state === "error") setState("idle"); }}
                placeholder="you@email.com"
                aria-invalid={state === "error"}
                aria-describedby={state === "error" ? "news-letter-err" : undefined}
                className="min-w-0 flex-1 rounded-xl border border-hairline bg-surface-2 px-3 py-2.5 text-sm text-content placeholder:text-content-subtle focus:border-gold-500/50 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
              />
              <button type="submit" disabled={state === "loading"} aria-label="Subscribe" className="btn-gold shrink-0 px-3.5 py-2.5 text-sm disabled:opacity-60">
                {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              </button>
            </form>
          )}
          {state === "error" && <p id="news-letter-err" role="alert" className="mt-2 text-[12px] text-amber-300">{msg}</p>}
        </motion.section>
      )}
    </AnimatePresence>
  );
}

/** The official community links from `site.ts`. No member counts. */
export function CommunityPanel() {
  const links = [
    { href: site.socials.telegram, label: "Telegram", Icon: TelegramIcon },
    { href: site.socials.x, label: "X", Icon: XIcon },
    { href: site.socials.youtube, label: "YouTube", Icon: YouTubeIcon },
    { href: site.socials.linkedin, label: "LinkedIn", Icon: LinkedInIcon },
  ];
  return (
    <section className="surface rounded-3xl p-5" aria-labelledby="news-community">
      <SectionHead id="news-community" icon={<Users className="h-4 w-4" />} title="Join the community" />
      <p className="-mt-2 mb-4 text-[13px] leading-relaxed text-content-muted">Discuss the news with traders, builders and researchers.</p>
      <div className="flex items-center gap-2">
        {links.map(({ href, label, Icon }) => (
          <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={`XYZ Crypto on ${label}`} className="grid h-10 w-10 place-items-center rounded-xl border border-hairline bg-surface-2 text-content-muted transition-colors hover:border-gold-500/40 hover:text-gold-300">
            <Icon className="h-4 w-4" />
          </a>
        ))}
        <Link href="/community" className="btn-gold ml-auto whitespace-nowrap px-4 py-2 text-[13px]">Open chat</Link>
      </div>
    </section>
  );
}
