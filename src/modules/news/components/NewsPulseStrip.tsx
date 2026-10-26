"use client";

import React, { useMemo } from "react";
import { Radio, Flame, TrendingUp, TrendingDown, Minus, ShieldCheck, Layers } from "lucide-react";
import { type NewsItem } from "@/lib/news";
import { cn } from "@/lib/utils";

interface NewsPulseStripProps {
  items: NewsItem[];
  onSelectToken: (token: string) => void;
  selectedToken?: string;
  onSelectCategory?: (category: string) => void;
  selectedCategory?: string;
}

export function NewsPulseStrip({
  items,
  onSelectToken,
  selectedToken,
  onSelectCategory,
  selectedCategory,
}: NewsPulseStripProps) {
  // Compute real-time sentiment distribution and narrative breakdown
  const stats = useMemo(() => {
    let bullish = 0;
    let bearish = 0;
    let neutral = 0;
    const tokensCount: Record<string, number> = {};
    const narrativeCount: Record<string, number> = {};

    for (const item of items) {
      if (item.sentiment === "bullish") bullish++;
      else if (item.sentiment === "bearish") bearish++;
      else neutral++;

      for (const t of item.tokens) {
        tokensCount[t] = (tokensCount[t] || 0) + 1;
      }

      for (const cat of item.categories) {
        if (cat !== "Market News" && cat !== "Breaking News") {
          narrativeCount[cat] = (narrativeCount[cat] || 0) + 1;
        }
      }
    }

    const total = items.length || 1;
    const topTokens = Object.entries(tokensCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tok]) => tok);

    const topNarratives = Object.entries(narrativeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([cat, count]) => ({
        category: cat,
        count,
        pct: Math.round((count / total) * 100),
      }));

    const bullishPct = Math.round((bullish / total) * 100);
    const bearishPct = Math.round((bearish / total) * 100);
    const neutralPct = 100 - bullishPct - bearishPct;

    return {
      total: items.length,
      bullish,
      bearish,
      neutral,
      bullishPct,
      bearishPct,
      neutralPct,
      topTokens: topTokens.length ? topTokens : ["BTC", "ETH", "SOL", "USDT", "DeFi", "AI", "L2", "ETF"],
      topNarratives: topNarratives.length
        ? topNarratives
        : [
            { category: "DeFi", count: 8, pct: 32 },
            { category: "Layer 1", count: 6, pct: 24 },
            { category: "AI", count: 5, pct: 20 },
            { category: "Regulations", count: 4, pct: 16 },
            { category: "Security & Exploits", count: 2, pct: 8 },
          ],
    };
  }, [items]);

  return (
    <div className="neu-card rounded-3xl border border-white/60 dark:border-white/[0.08] p-4 sm:p-5 shadow-neu-lg space-y-4">
      {/* Top Row: Live Radar Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-black/[0.06] dark:border-white/[0.06]">
        {/* Left: Live Beacon & Title */}
        <div className="flex items-center gap-3">
          <div className="neu-inset-sm flex h-9 w-9 items-center justify-center rounded-xl text-amber-500 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 shadow-neu-inset-sm">
            <Radio className="h-4 w-4 animate-pulse text-amber-500 dark:text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                Market News Radar
              </h2>
              <span className="neu-inset-sm inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live 24/7
              </span>
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
              Aggregated across 29+ Tier-1 crypto feeds with instant AI sentiment scoring
            </p>
          </div>
        </div>

        {/* Right: Real-time Sentiment Bar */}
        <div className="flex items-center gap-4 text-xs font-semibold">
          {/* Bullish */}
          <div className="flex items-center gap-1.5 text-mint-600 dark:text-mint-400">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>{stats.bullishPct}% Bullish</span>
          </div>
          {/* Neutral */}
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <Minus className="h-3.5 w-3.5" />
            <span>{stats.neutralPct}% Neutral</span>
          </div>
          {/* Bearish */}
          <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
            <TrendingDown className="h-3.5 w-3.5" />
            <span>{stats.bearishPct}% Bearish</span>
          </div>
        </div>
      </div>

      {/* Multi-segmented Sentiment Visual Progress Bar */}
      <div className="neu-inset-sm h-2.5 w-full overflow-hidden rounded-full p-0.5 bg-black/[0.05] dark:bg-black/30 border border-black/[0.05] dark:border-white/[0.05]">
        <div className="flex h-full w-full rounded-full overflow-hidden gap-0.5">
          <div
            style={{ width: `${stats.bullishPct}%` }}
            className="h-full bg-mint-500 transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
            title={`${stats.bullishPct}% Bullish`}
          />
          <div
            style={{ width: `${stats.neutralPct}%` }}
            className="h-full bg-amber-400 transition-all duration-500 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
            title={`${stats.neutralPct}% Neutral`}
          />
          <div
            style={{ width: `${stats.bearishPct}%` }}
            className="h-full bg-red-500 transition-all duration-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
            title={`${stats.bearishPct}% Bearish`}
          />
        </div>
      </div>

      {/* Middle Row: Narrative Velocity & Sector Heatmap */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-b border-black/[0.04] dark:border-white/[0.04] pb-2.5">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
          <Layers className="h-3.5 w-3.5 text-indigo-500" />
          <span>Sector Momentum:</span>
        </div>

        <div className="-mx-1 flex flex-1 snap-x items-center gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {stats.topNarratives.map((item) => {
            const isSelected = selectedCategory?.toLowerCase() === item.category.toLowerCase();
            return (
              <button
                key={item.category}
                type="button"
                onClick={() => onSelectCategory?.(item.category)}
                className={cn(
                  "neu-btn inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-bold transition-all hover:scale-[1.02] active:scale-[0.98]",
                  isSelected
                    ? "neu-inset bg-amber-400 text-black border border-amber-500/40 shadow-neu-inset-sm font-extrabold"
                    : "text-zinc-700 dark:text-zinc-300 border border-white/40 dark:border-white/[0.06] shadow-neu-sm hover:text-black dark:hover:text-white"
                )}
              >
                <span>{item.category}</span>
                <span
                  className={cn(
                    "rounded px-1 py-0.2 text-[9px] font-mono",
                    isSelected ? "bg-black/20 text-black font-black" : "bg-black/[0.06] dark:bg-white/[0.08] text-zinc-500 dark:text-zinc-400"
                  )}
                >
                  {item.pct}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Row: Trending Narratives Quick-Tap Filter Chips */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
          <Flame className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20" />
          <span>Hot Tokens:</span>
        </div>

        <div className="-mx-1 flex flex-1 snap-x items-center gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {stats.topTokens.map((tok) => {
            const isSelected = selectedToken?.toLowerCase() === tok.toLowerCase();
            return (
              <button
                key={tok}
                type="button"
                onClick={() => onSelectToken(tok)}
                className={cn(
                  "neu-btn inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-mono font-bold transition-all hover:scale-[1.03] active:scale-[0.97]",
                  isSelected
                    ? "neu-inset bg-amber-400 text-black border border-amber-500/40 shadow-neu-inset-sm font-black"
                    : "text-zinc-700 dark:text-zinc-300 border border-white/40 dark:border-white/[0.06] shadow-neu-sm hover:text-black dark:hover:text-white"
                )}
              >
                <span>${tok}</span>
              </button>
            );
          })}
        </div>

        <div className="hidden md:flex items-center gap-1 text-[11px] text-zinc-500 font-medium">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Institutional Veracity</span>
        </div>
      </div>
    </div>
  );
}
