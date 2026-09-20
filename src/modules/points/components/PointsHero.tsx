"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowRight, ArrowUpRight, BarChart2, Loader2, Plus, Radio, RefreshCw, X } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import { refreshUrl } from "@/lib/refetch";
import { wakeIsDue } from "@/lib/useLiveData";
import { RobotIcon } from "@/components/RobotIcon";
import { MarkdownLite } from "@/components/MarkdownLite";
import type { RadarItem } from "@modules/points/lib/airdrop-radar";
import { Composer } from "./UpdatesFeed";

const RADAR_WINDOW_MS = 120_000;

interface PointsHeroProps {
  onExplore?: () => void;
  onPortfolio?: () => void;
}

/** Standalone hero news card — matches the right-side of the mockup exactly. */
function HeroNewsCard() {
  const { data: session } = useSession();
  const canManage = hasPermission(session?.user as never, "points:manage");

  const [items, setItems] = useState<RadarItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "down">("loading");
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [composing, setComposing] = useState(false);
  const [viewAll, setViewAll] = useState(false);
  const [brief, setBrief] = useState<{
    loading: boolean;
    text: string | null;
    err: string | null;
  }>({ loading: false, text: null, err: null });
  const fetchedAtRef = useRef(0);

  const load = useCallback(async (force = false) => {
    try {
      const res = await fetch(refreshUrl("/api/points/radar", force), { cache: "no-store" });
      const j = await res.json();
      if (res.ok && Array.isArray(j.items)) {
        setItems(j.items);
        setState("ready");
        const now = Date.now();
        fetchedAtRef.current = now;
        setFetchedAt(now);
      } else {
        setState("down");
      }
    } catch {
      setState("down");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Wake refetch when tab comes back into focus
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === "hidden") return;
      if (wakeIsDue(Date.now(), fetchedAtRef.current, RADAR_WINDOW_MS)) void load();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [load]);

  const generateBrief = useCallback(async () => {
    const top = items.slice(0, 8);
    if (!top.length || brief.loading) return;
    setBrief({ loading: true, text: null, err: null });
    try {
      const res = await fetch("/api/ai/why-matters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Airdrop & perp DEX roundup",
          summary: top.map((i, n) => `${n + 1}. [${i.source}] ${i.title}${i.summary ? ` — ${i.summary}` : ""}`).join("\n").slice(0, 3800),
          mode: "roundup",
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Could not generate the briefing.");
      setBrief({ loading: false, text: j?.text ?? null, err: null });
    } catch (e) {
      setBrief({ loading: false, text: null, err: (e as Error).message });
    }
  }, [items, brief.loading]);

  // Carousel: up to 5 items; fallback placeholder when feed hasn't loaded yet
  const fallback: RadarItem = useMemo(() => ({
    id: "fallback-0",
    title: "Crypto ETF flows: Ether loses $141M as Solana gains $61M",
    summary: "U.S. spot crypto exchange-traded products recorded about $70.7 million in combined net outflows during the Sep. 14–18 trading week, as withdrawals from Ether funds outweighed demand for Bitcoin, Solana, and Hyperliquid products. According to data from Farside",
    url: "",
    source: "crypto.news",
    sourceIcon: null,
    publishedAt: 1789820000000,
    category: "Airdrops",
    image: "/images/crypto-banner.png",
    venues: ["Hyperliquid"],
  }), []);

  const carousel = useMemo(() => {
    const base = items.length > 0 ? items.slice(0, 5) : [fallback];
    return base;
  }, [items, fallback]);

  const active = carousel[activeIdx % carousel.length] ?? fallback;
  const rest = items.slice(1);
  const isLive = state !== "down";

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-transparent shadow-2xl">
      {/* ── Header row ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-white/[0.07] px-4 py-2.5">
        {/* Left: label + freshness */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Radio
            className={`h-3.5 w-3.5 shrink-0 ${isLive ? "text-emerald-400" : "text-rose-400"}`}
            strokeWidth={2.5}
          />
          <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            LATEST UPDATES
          </span>
          <span className="truncate text-[11px] text-gray-500 dark:text-gray-500">
            {items.length || 1} tracked · checked{" "}
            {fetchedAt ? formatDateTime(new Date(fetchedAt)) : "Sep 19, 9:20 AM"}
          </span>
        </div>

        {/* Right: action buttons */}
        <div className="flex shrink-0 items-center gap-1.5">
          {canManage && (
            <button
              type="button"
              onClick={() => setComposing(true)}
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300 transition-colors hover:bg-amber-500/20"
            >
              <Plus className="h-3 w-3" />
              Post
            </button>
          )}
          <button
            type="button"
            onClick={() => void generateBrief()}
            disabled={brief.loading || items.length === 0}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-white/[0.08] bg-gray-100 dark:bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-gray-800 dark:text-white transition-colors hover:bg-gray-200 dark:hover:bg-white/[0.08] disabled:opacity-40"
          >
            {brief.loading ? (
              <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
            ) : (
              <RobotIcon className="h-3.5 w-3.5 text-emerald-400" />
            )}
            AI brief
          </button>
          <button
            type="button"
            onClick={() => { void load(true); }}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-white/[0.08] bg-gray-100 dark:bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-gray-800 dark:text-white transition-colors hover:bg-gray-200 dark:hover:bg-white/[0.08]"
            aria-label="Refresh updates"
          >
            <RefreshCw
              className={`h-3 w-3 ${state === "loading" ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* ── AI Brief panel ──────────────────────────────────────────────── */}
      {(brief.loading || brief.text || brief.err) && (
        <div className="border-b border-gray-100 dark:border-white/[0.07] bg-gray-50 dark:bg-[#13151a] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-200">
              <RobotIcon className="h-3.5 w-3.5 text-emerald-400" />
              AI Summary
            </span>
            <button
              type="button"
              onClick={() => setBrief({ loading: false, text: null, err: null })}
              className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {brief.loading && (
            <p className="mt-1.5 text-xs text-gray-400">Summarizing latest headlines…</p>
          )}
          {brief.err && <p className="mt-1.5 text-xs text-amber-300">{brief.err}</p>}
          {brief.text && (
            <div className="mt-1.5 max-h-36 overflow-y-auto text-xs leading-relaxed text-gray-300">
              <MarkdownLite text={brief.text} />
            </div>
          )}
        </div>
      )}

      {/* ── Story card body ─────────────────────────────────────────────── */}
      <div className="p-4">
        {/* Source row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {/* Source icon / fallback circle */}
            {active.sourceIcon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={active.sourceIcon}
                alt={active.source}
                className="h-4 w-4 shrink-0 rounded-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-sky-400/30 bg-sky-500/20 text-[9px] font-bold text-sky-400">
                C
              </span>
            )}
            <span className="truncate text-xs font-semibold text-gray-700 dark:text-gray-300">
              {active.source}
            </span>
            {/* Venue pill */}
            <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              {active.venues[0] ?? active.category}
            </span>
          </div>
          <span className="shrink-0 text-[11px] text-gray-500 dark:text-gray-500">
            {formatDateTime(new Date(active.publishedAt))}
          </span>
        </div>

        {/* Title */}
        <h3 className="mt-1.5 line-clamp-2 text-sm font-bold leading-snug text-gray-900 dark:text-white sm:text-[15px]">
          {active.title}
        </h3>

        {/* Banner image — 110px fixed height, arrow on the right */}
        {/* Parent is position:relative with fixed height; img is absolute-inset so it can never push the parent taller */}
        <div
          className="relative mt-2.5 w-full overflow-hidden rounded-xl border border-white/10 bg-black/40"
          style={{ height: 110 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.image ?? "/images/crypto-banner.png"}
            alt={active.title}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/images/crypto-banner.png";
            }}
          />
          {/* Right-side next-story arrow — matches mockup */}
          <button
            type="button"
            onClick={() => setActiveIdx((prev) => (prev + 1) % carousel.length)}
            aria-label="Next story"
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", zIndex: 10 }}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/70 text-white shadow-xl backdrop-blur-md transition-all hover:scale-105 active:scale-105 hover:bg-black/90 active:bg-black/90"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Body snippet */}
        <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
          {active.summary}
        </p>

        {/* Attribution */}
        <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
          Reported by {active.source} · {active.source}
        </p>

        {/* ── Action bar ──────────────────────────────────────────────────── */}
        <div className="mt-3 flex items-center justify-between gap-2">
          {/* Read link */}
          {active.url ? (
            <a
              href={`/news/read?u=${encodeURIComponent(active.url)}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/[0.08] px-3.5 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/20"
            >
              Read the full story here
              <ArrowRight className="h-3 w-3" />
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/[0.08] px-3.5 py-1.5 text-xs font-semibold text-amber-300">
              Read the full story here
              <ArrowRight className="h-3 w-3" />
            </span>
          )}

          {/* 5 carousel dots — clearly visible as in mockup */}
          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIdx(i)}
                aria-label={`Story ${i + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${activeIdx === i ? "w-4 bg-amber-400" : "w-2 bg-zinc-600 hover:bg-zinc-400"
                  }`}
              />
            ))}
          </div>

          {/* View All Updates */}
          <button
            type="button"
            onClick={() => setViewAll(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 transition-colors hover:text-amber-300"
          >
            View All Updates
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

      </div>

      {/* ── View All modal ──────────────────────────────────────────────── */}
      {viewAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1012] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3.5">
              <div>
                <h3 className="text-base font-bold text-white">All Updates &amp; Signals</h3>
                {rest.length > 0 && (
                  <p className="mt-0.5 text-xs text-gray-500">{rest.length} more updates</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setViewAll(false)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 divide-y divide-white/[0.05] overflow-y-auto">
              {items.map((item) => (
                <a
                  key={item.id}
                  href={`/news/read?u=${encodeURIComponent(item.url)}`}
                  className="flex gap-3 p-4 transition-colors hover:bg-white/[0.03]"
                >
                  {item.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image}
                      alt=""
                      className="h-12 w-16 shrink-0 rounded-lg object-cover"
                      loading="lazy"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold leading-snug text-white line-clamp-2">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[11px] text-gray-500">
                      {item.source} · {formatDateTime(new Date(item.publishedAt))}
                    </p>
                  </div>
                </a>
              ))}
              {items.length === 0 && (
                <p className="p-6 text-center text-sm text-gray-500">
                  {state === "loading" ? "Loading…" : "No updates right now."}
                </p>
              )}
            </div>
            <div className="flex justify-end border-t border-white/[0.07] px-5 py-3">
              <button
                type="button"
                onClick={() => setViewAll(false)}
                className="rounded-lg bg-white/[0.08] px-4 py-2 text-xs font-semibold text-white hover:bg-white/[0.14]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Admin Composer modal ────────────────────────────────────────── */}
      {canManage && composing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0f1012] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3.5">
              <h3 className="text-base font-bold text-white">Post to Desk Wire</h3>
              <button
                type="button"
                onClick={() => setComposing(false)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <Composer onPosted={() => { setComposing(false); void load(true); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PointsHero({ onExplore, onPortfolio }: PointsHeroProps) {
  const [isDark, setIsDark] = useState(false);
  const [stats, setStats] = useState<{
    trackedProtocols: number;
    pointsAnalyzed: number;
    activeUsers: number;
  }>({
    trackedProtocols: 3,
    pointsAnalyzed: 12400000,
    activeUsers: 1,
  });

  useEffect(() => {
    // This project uses class-based dark mode: `dark` class on <html>
    const html = document.documentElement;
    setIsDark(html.classList.contains("dark"));

    const observer = new MutationObserver(() => {
      setIsDark(html.classList.contains("dark"));
    });
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });

    // Fetch live platform metrics
    let unmounted = false;
    fetch("/api/points/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!unmounted && data) {
          setStats({
            trackedProtocols: data.trackedProtocols ?? 3,
            pointsAnalyzed: data.pointsAnalyzed ?? 12400000,
            activeUsers: data.activeUsers ?? 1,
          });
        }
      })
      .catch(() => {});

    return () => {
      unmounted = true;
      observer.disconnect();
    };
  }, []);

  const formatPointsAnalyzed = (num: number) => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B+`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M+`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}k+`;
    return `$${num.toLocaleString("en-US")}`;
  };

  const formatUsers = (num: number) => {
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M+`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(0)}K+`;
    return `${num}+`;
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-hairline bg-gradient-to-b from-surface-2 via-surface-2 to-base p-6 sm:p-8 lg:p-10">
      {/* Background ambient radial glows */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-1/4 h-80 w-80 rounded-full bg-gold-400/5 blur-3xl" />

      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-8">
        {/* Left Column: Headline & Action */}
        <div className="lg:col-span-7 space-y-6">
          {/* Tag badge */}
          <span className="eyebrow eyebrow-glass inline-flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400/80" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-400" />
            </span>
            <span className="mono font-mono text-[10px] font-semibold uppercase tracking-[0.16em] sm:text-[11px]">
              <span className="text-[#fdf7e7]">Airdrop</span>{" "}
              <span className="text-shine">Farming</span>
            </span>
          </span>

          {/* Heading */}
          <div className="space-y-2">
            <h1 className="font-display text-4xl font-bold tracking-tight text-content sm:text-5xl lg:text-6xl">
              Points <span className="text-shine">Intelligence</span>
            </h1>
            <p
              className="max-w-xl text-sm leading-relaxed sm:text-base"
              style={{ color: isDark ? "#e5e7eb" : "#111827", textDecoration: "none" }}
            >
              Track points, estimate value, calculate farming costs and make smarter decisions across all major airdrop programs.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => (onExplore ? onExplore() : scrollTo("featured-programs"))}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-gold-400 via-gold-500 to-amber-500 px-6 py-2.5 text-xs font-bold text-black shadow-lg shadow-gold-500/20 transition-all hover:scale-[1.02] hover:shadow-gold-500/30 active:scale-[0.98]"
            >
              Explore Programs
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => (onPortfolio ? onPortfolio() : scrollTo("my-airdrops"))}
              className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-2 px-5 py-2.5 text-xs font-semibold text-content transition-all hover:border-gold-500/30 hover:bg-white/5 active:scale-[0.98]"
            >
              <BarChart2 className="h-3.5 w-3.5 text-gold-400" />
              My Portfolio
            </button>
          </div>

          {/* 4 Stats in a clean horizontal row */}
          <div className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-4 sm:gap-6 border-t border-hairline">
            <div>
              <div className="font-display text-2xl font-bold tracking-tight text-content">
                {stats.trackedProtocols}
              </div>
              <div className="text-[11px] text-content-subtle">Tracked Protocols</div>
            </div>
            <div>
              <div className="mono text-2xl font-bold tracking-tight text-content">
                {formatPointsAnalyzed(stats.pointsAnalyzed)}
              </div>
              <div className="text-[11px] text-content-subtle">Points Analyzed</div>
            </div>
            <div>
              <div className="font-display text-2xl font-bold tracking-tight text-content">
                {formatUsers(stats.activeUsers)}
              </div>
              <div className="text-[11px] text-content-subtle">Active Users</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-display text-2xl font-bold tracking-tight text-content">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Real-time
              </div>
              <div className="text-[11px] text-content-subtle">Data Updates</div>
            </div>
          </div>
        </div>

        {/* Right Column: Live News Card */}
        <div className="lg:col-span-5">
          <HeroNewsCard />
        </div>
      </div>
    </div>
  );
}
