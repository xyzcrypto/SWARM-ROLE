"use client";

import React from "react";
import Link from "next/link";
import { Flame, ChevronRight, Plus, Star } from "lucide-react";
import { useTickerPoll } from "@/lib/useTickerPoll";
import { cn } from "@/lib/utils";
import { useCurrency } from "../context/CurrencyContext";


export function HorizontalTrendingBar({ onOpenWatchlist }: { onOpenWatchlist?: () => void } = {}) {
  const { coins: polled } = useTickerPoll();
  const { formatPrice } = useCurrency();
  // Live prices only: until the ticker answers, the chips show as loading
  // rather than a hard-coded sample price list.
  const list = polled?.slice(0, 6) ?? [];

  return (
    <div className="flex items-center gap-2 w-full">
      {/* Left: Ticker chips container (smooth horizontal scroll on mobile) */}
      <div className="neu-convex flex flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-2xl border border-white/60 dark:border-white/[0.08] px-2.5 py-1.5 text-xs shadow-neu-sm touch-pan-x">
        {/* Trending story pill */}
        <Link
          href="/news"
          className="neu-inset-sm group flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-500/25 px-2 sm:px-2.5 py-1 font-semibold text-amber-700 dark:text-amber-300 transition-colors shadow-neu-inset-sm hover:scale-[1.02] active:scale-[1.02]"
        >
          <Flame className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 fill-amber-500/30 shrink-0" />
          <span className="font-bold text-amber-600 dark:text-amber-400 text-[11px] shrink-0">Trending</span>
          <span className="text-zinc-700 dark:text-zinc-300 group-hover:text-amber-600 dark:group-hover:text-amber-200 transition-colors ml-0.5 text-[11px] truncate max-w-[130px] sm:max-w-none">
            Latest market news
          </span>
          <ChevronRight className="h-3 w-3 text-zinc-500 group-hover:translate-x-0.5 group-active:translate-x-0.5 transition-transform shrink-0" />
        </Link>

        {/* Ticker chips horizontal track */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!list.length &&
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[22px] w-[118px] shrink-0 animate-pulse rounded-lg bg-white/[0.05]" />
            ))}
          {list.map((c) => {
            const up = c.change >= 0;
            return (
              <div
                key={c.symbol}
                className="neu-btn flex shrink-0 items-center gap-1.5 rounded-lg border border-white/40 dark:border-white/5 px-2 py-0.5 transition-all shadow-neu-sm hover:scale-[1.02] active:scale-[1.02]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.image}
                  alt=""
                  width={14}
                  height={14}
                  className="h-3.5 w-3.5 rounded-full ring-1 ring-white/10"
                  onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")}
                />
                <span className="font-bold text-zinc-800 dark:text-zinc-200 text-[11px]">{c.symbol}</span>
                <span className="mono text-zinc-700 dark:text-zinc-300 text-[11px]">{formatPrice(c.price)}</span>
                <span className={cn("mono text-[10px] font-semibold", up ? "text-mint-400" : "text-red-400")}>
                  {up ? "+" : ""}
                  {c.change.toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>

        {/* + Add button */}
        <button
          onClick={() => {
            const el = document.getElementById("markets-search-input") || document.getElementById("top-assets-table");
            el?.scrollIntoView({ behavior: "smooth" });
          }}
          className="neu-btn flex shrink-0 items-center justify-center gap-1 rounded-lg border border-white/40 dark:border-white/10 px-2.5 py-0.5 text-[10px] font-medium text-zinc-700 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-200 shadow-neu-sm hover:scale-[1.02] active:scale-[1.02]"
        >
          <Plus className="h-3 w-3" />
          <span>Add</span>
        </button>
      </div>

      {/* Right: Standalone My Watchlist Pill Card matching Image 2 */}
      <button
        // ⚠️ This scrolled to `#my-watchlist-section`, an id nothing on the page
        // has, so the button did nothing ("My Watchlist open nahi ho raha").
        // It now opens the Watchlist tab through the parent.
        onClick={() => onOpenWatchlist?.()}
        aria-label="Open my watchlist"
        className="neu-card group hidden lg:flex shrink-0 items-center justify-between gap-2.5 rounded-xl border border-white/60 dark:border-white/[0.08] px-2.5 py-1 text-xs shadow-neu-sm hover:border-amber-400/40 hover:scale-[1.02] active:scale-[1.02] transition-all h-[36px]"
      >
        <div className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400 font-semibold text-[11px]">
          <Star className="h-3.5 w-3.5 fill-amber-400/20 text-amber-400" />
          <span>My Watchlist</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center -space-x-1">
            <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#f7931a] text-white text-[8px] font-bold ring-1 ring-ink-950">₿</div>
            <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#627eea] text-white text-[8px] font-bold ring-1 ring-ink-950">♦</div>
            <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gradient-to-tr from-[#9945FF] to-[#14F195] text-white text-[7px] font-bold ring-1 ring-ink-950">◎</div>
          </div>
          <div className="neu-inset-sm flex h-4 w-4 items-center justify-center rounded-full border border-white/10 group-hover:border-amber-400/50 shadow-neu-inset-sm">
            <ChevronRight className="h-2.5 w-2.5 text-zinc-400 group-hover:text-amber-400 transition-colors" />
          </div>
        </div>
      </button>
    </div>
  );
}
