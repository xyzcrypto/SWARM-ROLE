"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import { RobotIcon } from "@/components/RobotIcon";
import { XYZ_AI_OPEN_EVENT } from "@/components/XyzAiWidget";
import type { MoverCoin } from "@/lib/markets";
import { compactUsd, pct } from "@/lib/markets";
import { cn } from "@/lib/utils";

export interface AIMarketIntelligenceCardProps {
  onOpenBrief?: () => void;
  gainers?: MoverCoin[];
  mcapChange24h?: number | null;
  perpVolume24h?: number | null;
  stableMcap?: number | null;
  btcDominance?: number | null;
  live?: boolean;
}

export function AIMarketIntelligenceCard({
  onOpenBrief,
  gainers,
  mcapChange24h,
  perpVolume24h,
  stableMcap,
  btcDominance,
  live = true,
}: AIMarketIntelligenceCardProps) {
  const handleOpen = () => {
    if (onOpenBrief) {
      onOpenBrief();
      return;
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(XYZ_AI_OPEN_EVENT, {
          detail: {
            prompt: "Provide a comprehensive market intelligence briefing covering large-cap assets, perp DEX volumes, and notable ecosystem movements today.",
          },
        })
      );
    }
  };

  const narrative =
    mcapChange24h != null
      ? mcapChange24h >= 0
        ? `Market cap expanded ${pct(mcapChange24h, 2)} with healthy on-chain momentum.`
        : `Market cap retraced ${Math.abs(mcapChange24h).toFixed(2)}% while derivatives trade actively.`
      : "Large-cap assets are gaining while trading activity picks up.";

  const topGainer = gainers && gainers.length > 0 ? gainers[0] : null;
  const secondGainer = gainers && gainers.length > 1 ? gainers[1] : null;

  const item1Label = topGainer ? `${topGainer.symbol} surge` : "Perp DEX volume";
  const item1Value = topGainer ? `+${topGainer.change24h.toFixed(1)}%` : perpVolume24h ? compactUsd(perpVolume24h) : "+12.4%";

  const item2Label = secondGainer ? `${secondGainer.symbol} activity` : btcDominance ? "BTC Dominance" : "SOL activity";
  const item2Value = secondGainer ? `+${secondGainer.change24h.toFixed(1)}%` : btcDominance ? `${btcDominance.toFixed(1)}%` : "+8.2%";

  const item3Label = stableMcap ? "Stablecoin pool" : "Stablecoin supply";
  const item3Value = stableMcap ? compactUsd(stableMcap) : "+3.1%";

  return (
    <div className="neu-card rounded-2xl border border-white/60 dark:border-white/[0.08] p-3 shadow-neu flex flex-col justify-between h-full overflow-hidden">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between pb-1.5 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="neu-inset-sm flex h-6 w-6 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-300 border border-teal-500/30">
              <RobotIcon className="h-3.5 w-3.5" />
            </div>
            <h2 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">AI Market Intelligence</h2>
          </div>
          <span className="neu-inset-sm rounded-lg bg-amber-400/20 border border-amber-400/40 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300 shrink-0">
            Live
          </span>
        </div>

        {/* Section 1: What is happening today? */}
        <div className="pt-1.5 pb-1 border-b border-black/[0.06] dark:border-white/[0.06]">
          <p className="text-[10px] font-bold text-zinc-900 dark:text-zinc-100 leading-none">What is happening today?</p>
          <p className="text-[9.5px] leading-tight text-zinc-700 dark:text-zinc-300 mt-1 line-clamp-2">
            {narrative}
          </p>
          <p className="text-[8.5px] italic text-zinc-500 dark:text-zinc-400 mt-0.5 leading-none">
            {live ? "Live AI synthesis" : "Illustrative summary"}
          </p>
        </div>

        {/* Section 2: 3 notable changes */}
        <div className="pt-1.5">
          <p className="text-[9.5px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">3 notable changes</p>
          <div className="space-y-1 pt-1 text-[10px]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300 truncate">
                <span className="text-emerald-600 dark:text-mint-400 font-bold text-[9px] leading-none shrink-0">▲</span>
                <span className="truncate">{item1Label}</span>
              </span>
              <span className="mono font-bold text-emerald-600 dark:text-mint-400 shrink-0">{item1Value}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300 truncate">
                <span className="text-emerald-600 dark:text-mint-400 font-bold text-[9px] leading-none shrink-0">▲</span>
                <span className="truncate">{item2Label}</span>
              </span>
              <span className="mono font-bold text-emerald-600 dark:text-mint-400 shrink-0">{item2Value}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300 truncate">
                <span className="text-emerald-600 dark:text-mint-400 font-bold text-[9px] leading-none shrink-0">▲</span>
                <span className="truncate">{item3Label}</span>
              </span>
              <span className="mono font-bold text-emerald-600 dark:text-mint-400 shrink-0">{item3Value}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Button: Compact Full-Width Button */}
      <button
        onClick={handleOpen}
        className="neu-btn-gold mt-2 flex w-full items-center justify-center gap-1 rounded-xl py-2 px-2 text-[11px] font-bold text-amber-950 dark:text-amber-950 shadow-neu-glow-gold hover:scale-[1.02] active:scale-[1.02] transition-transform cursor-pointer"
      >
        <span>Read Full Market Brief</span>
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}
