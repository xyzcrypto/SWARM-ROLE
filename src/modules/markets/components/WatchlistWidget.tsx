"use client";

import React, { useState } from "react";
import { useWatchlist, toggleWatchlist } from "../lib/watchlist";
import { hapticToggle } from "@shared/utils/haptics";
import Link from "next/link";
import { Star, Bell, Plus, ArrowRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { coinPrice, type CoinRow } from "@/lib/markets";

interface WatchlistWidgetProps {
  coins?: CoinRow[];
  onViewAll?: () => void;
}

// Display names for the default watchlist ids, so a starred coin still has a
// label before live prices arrive. No prices here: those only come from the feed.
const KNOWN: Record<string, { symbol: string; image: string }> = {
  bitcoin: { symbol: "BTC", image: "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png" },
  ethereum: { symbol: "ETH", image: "https://coin-images.coingecko.com/coins/images/279/large/ethereum.png" },
  solana: { symbol: "SOL", image: "https://coin-images.coingecko.com/coins/images/4128/large/solana.png" },
  hyperliquid: { symbol: "HYPE", image: "https://assets.coingecko.com/coins/images/50882/small/hyperliquid.jpg" },
  sui: { symbol: "SUI", image: "https://assets.coingecko.com/coins/images/26375/small/sui-ocean-square.png" },
};

function fmtPrice(p: number) {
  return coinPrice(p);
}

function MiniSparkline({ data, up }: { data: number[]; up: boolean }) {
  if (!data || data.length < 2) return <div className="w-12 h-4" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 48;
  const h = 16;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / range) * (h - 5)).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-12 h-4 overflow-visible shrink-0" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={up ? "#10b981" : "#ef4444"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: up ? "drop-shadow(0 0 3px rgba(16, 185, 129, 0.55))" : "drop-shadow(0 0 3px rgba(239, 68, 68, 0.55))" }}
      />
    </svg>
  );
}

export function WatchlistWidget({ coins, onViewAll }: WatchlistWidgetProps) {
  const starredIds = useWatchlist();
  const [alertIds, setAlertIds] = useState<Set<string>>(new Set());

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    hapticToggle();
    toggleWatchlist(id);
  };

  const toggleAlert = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAlertIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Derive rows from coins matching starredIds, or fallback
  const rows = React.useMemo(() => {
    const coinMap = new Map<string, CoinRow>();
    if (coins && coins.length > 0) {
      for (const c of coins) {
        coinMap.set(c.id.toLowerCase(), c);
        coinMap.set(c.symbol.toLowerCase(), c);
      }
    }

    const items: Array<{
      id: string;
      symbol: string;
      price: number | null;
      change24h: number | null;
      image?: string;
      sparkline: number[];
    }> = [];

    for (const sid of starredIds) {
      const liveCoin = coinMap.get(sid.toLowerCase());
      if (liveCoin) {
        items.push({
          id: liveCoin.id,
          symbol: liveCoin.symbol,
          price: liveCoin.price,
          change24h: liveCoin.change24h,
          image: liveCoin.image || undefined,
          sparkline: (liveCoin.spark24h && liveCoin.spark24h.length >= 2 ? liveCoin.spark24h : liveCoin.sparkline ?? []).slice(-12),
        });
      } else {
        const known = KNOWN[sid];
        items.push({ id: sid, symbol: known?.symbol ?? sid.toUpperCase(), price: null, change24h: null, image: known?.image, sparkline: [] });
      }
      if (items.length >= 5) break;
    }

    return items;
  }, [coins, starredIds]);

  return (
    <div className="neu-card rounded-2xl border border-white/60 dark:border-white/[0.08] p-4 shadow-neu flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <Star className="h-4 w-4 fill-amber-400 text-amber-500 dark:text-amber-400" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">My Watchlist</h2>
        </div>
        <div className="flex items-center gap-2">
          {onViewAll ? (
            <button
              type="button"
              onClick={onViewAll}
              className="flex items-center gap-0.5 text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-500 transition-colors cursor-pointer"
            >
              View All
              <ArrowRight className="h-3 w-3" />
            </button>
          ) : (
            <Link
              href="/markets"
              className="flex items-center gap-0.5 text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-500 transition-colors"
            >
              View All
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
          <button
            onClick={() => {
              const el = document.getElementById("markets-search-input") || document.getElementById("top-assets-table");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            title="Add asset to watchlist"
            className="neu-btn flex h-6 w-6 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-400/20 text-amber-800 dark:text-amber-300 shadow-neu-sm hover:scale-[1.02] active:scale-[1.02] transition-transform"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Table Headers */}
      <div className="flex items-center gap-1 py-1.5 text-[0.625rem] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-black/[0.04] dark:border-white/[0.04]">
        <div className="w-4 text-center shrink-0">#</div>
        <div className="flex-1 min-w-0">Asset</div>
        <div className="w-[3.875rem] text-right shrink-0">Price</div>
        <div className="w-[3.125rem] text-right shrink-0">24h %</div>
        <div className="w-[3.625rem] text-right shrink-0">Chart</div>
        <div className="w-4 shrink-0" />
      </div>

      {/* Rows */}
      <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04] flex-1">
        {rows.map((r, i) => {
          const up = (r.change24h ?? 0) >= 0;

          return (
            <Link
              key={r.id}
              href={`/markets/${r.id}`}
              className="flex items-center gap-1 py-2 px-0.5 rounded-lg transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03] group text-xs"
            >
              {/* Rank */}
              <div className="w-4 text-center mono text-[0.6875rem] text-zinc-500 dark:text-zinc-500 shrink-0">
                {i + 1}
              </div>

              {/* Asset Logo & Symbol */}
              <div className="flex-1 flex items-center gap-1.5 min-w-0">
                {r.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image} alt="" className="h-4 w-4 rounded-full ring-1 ring-black/10 dark:ring-white/10 shrink-0" />
                )}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors truncate">
                  {r.symbol}
                </span>
              </div>

              {/* Price */}
              <div className="w-[3.875rem] text-right mono text-zinc-800 dark:text-zinc-200 font-medium shrink-0">
                {r.price != null ? fmtPrice(r.price) : "-"}
              </div>

              {/* 24h % */}
              <div
                className={cn(
                  "w-[3.125rem] text-right mono font-semibold text-[0.6875rem] shrink-0",
                  up ? "text-emerald-600 dark:text-mint-400" : "text-rose-600 dark:text-red-400"
                )}
              >
                {r.change24h != null ? `${up ? "+" : ""}${r.change24h.toFixed(2)}%` : "-"}
              </div>

              {/* Sparkline & More actions */}
              <div className="w-[3.625rem] flex items-center justify-end shrink-0">
                <MiniSparkline data={r.sparkline} up={up} />
              </div>
              <div className="w-4 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={(e) => toggleAlert(r.id, e)}
                  aria-label="More options"
                  className="p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Bottom Action: + Add to Watchlist */}
      <button
        onClick={() => {
          const el = document.getElementById("markets-search-input") || document.getElementById("top-assets-table");
          el?.scrollIntoView({ behavior: "smooth" });
        }}
        className="neu-btn mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/60 dark:border-white/10 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 shadow-neu-sm hover:scale-[1.02] active:scale-[1.02] transition-transform cursor-pointer"
      >
        <Plus className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
        <span>Add to Watchlist</span>
      </button>
    </div>
  );
}
