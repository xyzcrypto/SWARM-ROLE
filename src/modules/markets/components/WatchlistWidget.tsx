"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Star, Bell, Plus, ArrowRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { coinPrice, type CoinRow } from "@/lib/markets";

interface WatchlistWidgetProps {
  coins?: CoinRow[];
  onViewAll?: () => void;
}

const defaultWatchlist = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", price: 83520, change24h: 0.65, image: "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png?1696501400", sparkline: [82400, 82900, 83100, 83520] },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 2528, change24h: 0.73, image: "https://coin-images.coingecko.com/coins/images/279/large/ethereum.png?1696501628", sparkline: [2490, 2505, 2510, 2528] },
  { id: "solana", symbol: "SOL", name: "Solana", price: 111.3, change24h: 1.0, image: "https://coin-images.coingecko.com/coins/images/4128/large/solana.png?1718769756", sparkline: [108, 109, 110, 111.3] },
  { id: "hyperliquid", symbol: "HYPE", name: "Hyperliquid", price: 27.8, change24h: 6.84, image: "https://assets.coingecko.com/coins/images/50882/small/hyperliquid.jpg", sparkline: [25.8, 26.2, 26.9, 27.2, 27.8] },
  { id: "sui", symbol: "SUI", name: "Sui", price: 2.14, change24h: 3.21, image: "https://assets.coingecko.com/coins/images/26375/small/sui-ocean-square.png", sparkline: [2.06, 2.08, 2.1, 2.11, 2.14] },
];

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
  const [starredIds, setStarredIds] = useState<Set<string>>(() => new Set(["bitcoin", "ethereum", "solana", "hyperliquid", "sui"]));
  const [alertIds, setAlertIds] = useState<Set<string>>(new Set());

  // Load saved watchlist preferences from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("xyz_user_watchlist");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setStarredIds(new Set(parsed));
        }
      }
    } catch {
      // fallback to defaults
    }
  }, []);

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem("xyz_user_watchlist", JSON.stringify(Array.from(next)));
        window.dispatchEvent(new Event("watchlist-updated"));
      } catch {
        // ignore
      }
      return next;
    });
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
      name: string;
      price: number;
      change24h: number;
      image?: string;
      sparkline: number[];
    }> = [];

    for (const sid of starredIds) {
      const liveCoin = coinMap.get(sid.toLowerCase());
      if (liveCoin) {
        items.push({
          id: liveCoin.id,
          symbol: liveCoin.symbol,
          name: liveCoin.name,
          price: liveCoin.price,
          change24h: liveCoin.change24h,
          image: liveCoin.image || undefined,
          sparkline: liveCoin.sparkline && liveCoin.sparkline.length >= 2 ? liveCoin.sparkline.slice(-12) : [liveCoin.price * 0.98, liveCoin.price],
        });
      } else {
        const def = defaultWatchlist.find((d) => d.id === sid || d.symbol.toLowerCase() === sid.toLowerCase());
        if (def) items.push(def);
      }
      if (items.length >= 5) break;
    }

    return items.length > 0 ? items : defaultWatchlist;
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
      <div className="flex items-center gap-1 py-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-black/[0.04] dark:border-white/[0.04]">
        <div className="w-4 text-center shrink-0">#</div>
        <div className="flex-1 min-w-0">Asset</div>
        <div className="w-[62px] text-right shrink-0">Price</div>
        <div className="w-[50px] text-right shrink-0">24h %</div>
        <div className="w-[58px] text-right shrink-0">Chart</div>
        <div className="w-4 shrink-0" />
      </div>

      {/* Rows */}
      <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04] flex-1">
        {rows.map((r, i) => {
          const up = r.change24h >= 0;

          return (
            <Link
              key={r.id}
              href={`/markets/${r.id}`}
              className="flex items-center gap-1 py-2 px-0.5 rounded-lg transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03] group text-xs"
            >
              {/* Rank */}
              <div className="w-4 text-center mono text-[11px] text-zinc-500 dark:text-zinc-500 shrink-0">
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
              <div className="w-[62px] text-right mono text-zinc-800 dark:text-zinc-200 font-medium shrink-0">
                {fmtPrice(r.price)}
              </div>

              {/* 24h % */}
              <div
                className={cn(
                  "w-[50px] text-right mono font-semibold text-[11px] shrink-0",
                  up ? "text-emerald-600 dark:text-mint-400" : "text-rose-600 dark:text-red-400"
                )}
              >
                {up ? "+" : ""}{r.change24h.toFixed(2)}%
              </div>

              {/* Sparkline & More actions */}
              <div className="w-[58px] flex items-center justify-end shrink-0">
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
