"use client";

import React, { useState } from "react";
import {
  BarChart3,
  Coins,
  Layers,
  Activity,
  Link2,
  Percent,
  Flame,
  Star,
  Plus,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "../context/CurrencyContext";

export const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "coins", label: "Coins", icon: Coins },
  { id: "defi", label: "DeFi", icon: Layers },
  { id: "perps", label: "Perp DEX", icon: Activity },
  { id: "dex", label: "DEX & Fees", icon: Link2 },
  { id: "yields", label: "Yields", icon: Percent },
  { id: "trending", label: "Trending", icon: Flame },
  { id: "watchlist", label: "Watchlist", icon: Star },
] as const;

export type TabId = (typeof TABS)[number]["id"];

interface HeroMarketSectionProps {
  allLive?: boolean;
  activeTab?: TabId;
  onSelectTab?: (tabId: TabId) => void;
  onNavigateWatchlist?: () => void;
  watchlistCount?: number;
}

export function HeroMarketSection({
  allLive = true,
  activeTab = "overview",
  onSelectTab,
  onNavigateWatchlist,
  watchlistCount,
}: HeroMarketSectionProps) {
  const { currency, setCurrency, inrRate, isLive } = useCurrency();
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);

  const handleWatchlistClick = () => {
    if (onSelectTab) onSelectTab("watchlist");
    else if (onNavigateWatchlist) onNavigateWatchlist();
  };

  return (
    <div className="neu-convex relative overflow-hidden rounded-2xl border border-white/70 dark:border-white/[0.08] shadow-neu-lg min-h-[10rem] sm:h-[8.625rem] flex flex-col justify-between p-3.5 sm:px-[1.75rem] sm:pt-3.5 sm:pb-2.5">
      {/* ── Background: Left & bottom shifted so middle skyline top is visible and rightmost watchlist sits in pure dark space ── */}
      <div className="pointer-events-none absolute inset-0 select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/markets-hero.webp"
          alt="Web3 Markets Hero"
          className="w-full h-full object-cover object-[78%_50%] sm:object-[60%_25%] opacity-100 transition-all duration-300"
        />
        {/* Soft linear vignette on the left to guarantee high contrast for title without hiding the artwork */}
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950/90 via-ink-950/35 to-transparent w-[68%] sm:w-3/5" />
        {/* Right fade: desktop only (ensures behind My Watchlist on desktop has clean dark space, removed on mobile) */}
        <div className="hidden sm:block absolute inset-y-0 right-0 w-[15rem] bg-gradient-to-l from-ink-950/95 via-ink-950/90 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/60 via-transparent to-transparent" />
      </div>

      {/* ── Top Area: Responsive Title + Currency / Watchlist ── */}
      <div className="relative z-10 flex flex-col">
        <div className="flex items-center justify-between sm:block">
          <h1 className="text-2xl sm:text-[2.125rem] lg:text-[2.375rem] font-black tracking-tight text-[#ffffff] !text-[#ffffff] leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            Web3 <span className="text-amber-400 font-extrabold drop-shadow-[0_2px_8px_rgba(245,158,11,0.35)]">Markets</span>
          </h1>

          {/* Mobile-only currency switcher & live pill on the top right */}
          <div className="flex sm:hidden items-center gap-1.5">
            <span
              className={cn(
                "h-2 w-2 rounded-full shrink-0",
                allLive
                  ? "bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse"
                  : "bg-amber-400 shadow-[0_0_8px_#f59e0b]"
              )}
            />
            {/* Currency Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowCurrencyMenu(!showCurrencyMenu)}
                className="neu-inset-sm inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/60 px-2 py-0.5 text-zinc-300 hover:text-white backdrop-blur-md shadow-neu-inset-sm transition-all"
                title="Switch Currency (USD / INR)"
                aria-label="Switch Currency"
              >
                <span className="font-bold text-[0.625rem] text-amber-300">{currency}</span>
                <span className="text-[0.5625rem] text-zinc-400 font-mono">({currency === "INR" ? "₹" : "$"})</span>
                <ChevronDown className={cn("h-3 w-3 text-zinc-400 transition-transform duration-200", showCurrencyMenu && "rotate-180")} />
              </button>

              {showCurrencyMenu && (
                <div className="neu-convex absolute right-0 top-full mt-1.5 z-50 min-w-[8.4375rem] rounded-xl border border-white/20 bg-zinc-950/95 p-1 shadow-neu-lg backdrop-blur-xl">
                  <button
                    onClick={() => {
                      setCurrency("USD");
                      setShowCurrencyMenu(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between px-2.5 py-1.5 text-[0.6875rem] font-semibold rounded-lg transition-colors text-left",
                      currency === "USD"
                        ? "bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30"
                        : "text-zinc-300 hover:bg-white/10"
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="text-amber-400 font-bold">$</span> USD
                    </span>
                    <span className="text-[0.5625rem] mono text-zinc-400 font-normal">$1.00</span>
                  </button>

                  <button
                    onClick={() => {
                      setCurrency("INR");
                      setShowCurrencyMenu(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between px-2.5 py-1.5 text-[0.6875rem] font-semibold rounded-lg transition-colors text-left mt-0.5",
                      currency === "INR"
                        ? "bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30"
                        : "text-zinc-300 hover:bg-white/10"
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="text-emerald-400 font-bold">₹</span> INR
                    </span>
                    <span className="text-[0.5625rem] mono text-emerald-400 font-semibold">{inrRate == null ? "-" : "₹" + inrRate.toFixed(2)}</span>
                  </button>

                  {isLive && (
                    <div className="flex items-center justify-center gap-1 pt-1 mt-1 border-t border-white/10 text-[0.53125rem] text-zinc-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>Live Forex Rate</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="text-[0.6875rem] sm:text-xs text-[#e4e4e7] !text-[#e4e4e7] leading-tight mt-1 max-w-lg drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          Real-time market data, trends, yields and on-chain insights.
        </p>

        {/* Mobile-only Watchlist Pill Row */}
        <div className="flex sm:hidden items-center justify-between mt-2">
          <button
            onClick={handleWatchlistClick}
            className="neu-card inline-flex items-center gap-2 rounded-lg border border-white/20 bg-black/60 px-2 py-1 text-left backdrop-blur-md shadow-neu-sm"
          >
            <div className="flex items-center gap-1 text-[0.65625rem] font-semibold text-zinc-200">
              <Plus className="h-2.5 w-2.5 text-amber-400" />
              <span>Watchlist</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#f7931a] text-white text-[0.5rem] font-bold">₿</span>
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#627eea] text-white text-[0.5rem] font-bold">♦</span>
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gradient-to-tr from-[#9945FF] to-[#14F195] text-white text-[0.4375rem] font-bold">◎</span>
              <span className="rounded-full bg-white/10 px-1 text-[0.46875rem] font-bold text-zinc-300">+{watchlistCount !== undefined ? Math.max(1, watchlistCount - 3) : 8}</span>
            </div>
            <ChevronRight className="h-3 w-3 text-amber-400" />
          </button>
        </div>
      </div>

      {/* ── Desktop-Only: Top-Right Sample data + USD/INR Switcher + My Watchlist Card ── */}
      <div className="hidden sm:flex absolute right-[1.75rem] top-2.5 z-20 flex-col items-end gap-1">
        {/* Top sub-row: Live feed + USD/INR Switcher ⌵ */}
        <div className="flex items-center gap-2 text-xs">
          <div className="inline-flex items-center gap-1.5 text-zinc-300 drop-shadow-sm">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                allLive
                  ? "bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse"
                  : "bg-amber-400 shadow-[0_0_8px_#f59e0b]"
              )}
            />
            <span className="font-medium text-[0.6875rem]">{allLive ? "Live feed" : "Syncing..."}</span>
          </div>

          {/* Interactive USD / INR Currency Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowCurrencyMenu(!showCurrencyMenu)}
              className="neu-inset-sm inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 hover:bg-black/60 px-2.5 py-0.5 text-zinc-300 hover:text-white backdrop-blur-md shadow-neu-inset-sm transition-all hover:scale-[1.03] active:scale-[0.98]"
              title="Switch Currency (USD / INR)"
              aria-label="Switch Currency"
            >
              <span className="font-bold text-[0.65625rem] text-amber-300">{currency}</span>
              <span className="text-[0.5625rem] text-zinc-400 font-mono">({currency === "INR" ? "₹" : "$"})</span>
              <ChevronDown className={cn("h-3 w-3 text-zinc-400 transition-transform duration-200", showCurrencyMenu && "rotate-180")} />
            </button>

            {showCurrencyMenu && (
              <div className="neu-convex absolute right-0 top-full mt-1.5 z-50 min-w-[8.4375rem] rounded-xl border border-white/20 bg-zinc-950/95 p-1 shadow-neu-lg backdrop-blur-xl">
                <button
                  onClick={() => {
                    setCurrency("USD");
                    setShowCurrencyMenu(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between px-2.5 py-1.5 text-[0.6875rem] font-semibold rounded-lg transition-colors text-left",
                    currency === "USD"
                      ? "bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30"
                      : "text-zinc-300 hover:bg-white/10"
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="text-amber-400 font-bold">$</span> USD
                  </span>
                  <span className="text-[0.5625rem] mono text-zinc-400 font-normal">$1.00</span>
                </button>

                <button
                  onClick={() => {
                    setCurrency("INR");
                    setShowCurrencyMenu(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between px-2.5 py-1.5 text-[0.6875rem] font-semibold rounded-lg transition-colors text-left mt-0.5",
                    currency === "INR"
                      ? "bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30"
                      : "text-zinc-300 hover:bg-white/10"
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="text-emerald-400 font-bold">₹</span> INR
                  </span>
                  <span className="text-[0.5625rem] mono text-emerald-400 font-semibold">{inrRate == null ? "-" : "₹" + inrRate.toFixed(2)}</span>
                </button>

                {isLive && (
                  <div className="flex items-center justify-center gap-1 pt-1 mt-1 border-t border-white/10 text-[0.53125rem] text-zinc-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Live Forex Rate</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom sub-row: My Watchlist mini-card matching Image */}
        <button
          onClick={handleWatchlistClick}
          className="neu-card flex flex-col gap-0.5 rounded-xl border border-white/20 dark:border-white/10 bg-black/50 hover:border-amber-400/50 hover:bg-black/70 px-2.5 py-1 text-left transition-all backdrop-blur-md shadow-neu-sm group min-w-[9.0625rem] hover:scale-[1.02] active:scale-[1.02]"
        >
          <div className="flex items-center gap-1.5 text-[0.6875rem] font-semibold text-zinc-200 group-hover:text-amber-300 transition-colors">
            <Plus className="h-3 w-3 text-zinc-400 group-hover:text-amber-300" />
            <span>My Watchlist</span>
          </div>
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-1">
              {/* Bitcoin circular icon */}
              <div className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-[#f7931a] text-white text-[0.5625rem] font-bold shadow-sm">
                ₿
              </div>
              {/* Ethereum circular icon */}
              <div className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-[#627eea] text-white text-[0.5625rem] font-bold shadow-sm">
                ♦
              </div>
              {/* Solana circular icon */}
              <div className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#9945FF] to-[#14F195] text-white text-[0.5rem] font-bold shadow-sm">
                ◎
              </div>
              {/* +Badge */}
              <div className="neu-inset-sm flex h-4.5 shrink-0 items-center justify-center rounded-full bg-white/10 border border-white/10 px-1 text-[0.5rem] font-bold text-zinc-300 shadow-neu-inset-sm">
                +{watchlistCount !== undefined ? Math.max(1, watchlistCount - 3) : 8}
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-amber-400 group-hover:translate-x-0.5 group-active:translate-x-0.5 transition-transform shrink-0" />
          </div>
        </button>
      </div>

      {/* ── Bottom: Interactive Tabs (Scrollable on mobile, absolute pinned on desktop) ── */}
      <div className="relative z-10 mt-2 sm:mt-0 sm:absolute sm:left-[1.75rem] sm:bottom-2.5 flex items-center gap-1 sm:gap-1.5 overflow-x-auto [scrollbar-width:none] -mx-1 px-1 touch-pan-x">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          const isWatchlist = t.id === "watchlist";

          return (
            <button
              key={t.id}
              onClick={() => onSelectTab?.(t.id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2 sm:px-2.5 py-1 text-[0.6875rem] font-medium transition-all backdrop-blur-sm h-[1.625rem] hover:scale-[1.02] active:scale-[1.02] shrink-0",
                active
                  ? "neu-inset bg-amber-400/25 border border-amber-400/60 text-amber-300 shadow-neu-inset-sm font-semibold"
                  : isWatchlist
                    ? "neu-btn border border-amber-400/70 bg-black/40 text-amber-300 hover:bg-amber-400/10 shadow-neu-sm"
                    : "neu-btn border border-white/15 bg-black/35 text-zinc-200 hover:border-white/30 hover:bg-black/55 hover:text-white shadow-neu-sm"
              )}
            >
              <Icon
                className={cn(
                  "h-3 w-3",
                  active
                    ? "text-amber-300"
                    : isWatchlist
                      ? "text-amber-400 fill-amber-400/20"
                      : "text-zinc-400"
                )}
              />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
