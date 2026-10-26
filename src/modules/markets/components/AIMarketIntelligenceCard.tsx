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
  live = false,
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

  // Everything here is built from the live feeds passed in. Nothing is
  // generated or sampled: with no data a row shows "-".
  const narrative =
    mcapChange24h != null
      ? `Total market cap is ${mcapChange24h >= 0 ? "up" : "down"} ${Math.abs(mcapChange24h).toFixed(2)}% in 24h${
          btcDominance ? `, with BTC dominance at ${btcDominance.toFixed(1)}%` : ""
        }.`
      : "Waiting for live market data.";

  const [g1, g2] = gainers ?? [];
  const items: { label: string; value: string; up: boolean | null }[] = [
    { label: g1 ? `${g1.symbol} top gainer` : "Top gainer", value: g1 ? pct(g1.change24h, 1) : "-", up: g1 ? g1.change24h >= 0 : null },
    { label: g2 ? `${g2.symbol} runner-up` : "Runner-up", value: g2 ? pct(g2.change24h, 1) : "-", up: g2 ? g2.change24h >= 0 : null },
    perpVolume24h
      ? { label: "Perp DEX volume", value: compactUsd(perpVolume24h), up: null }
      : { label: "Stablecoin supply", value: stableMcap ? compactUsd(stableMcap) : "-", up: null },
  ];

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
          {live && (
            <span className="neu-inset-sm rounded-lg bg-amber-400/20 border border-amber-400/40 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300 shrink-0">
              Live
            </span>
          )}
        </div>

        {/* Section 1: What is happening today? */}
        <div className="pt-1.5 pb-1 border-b border-black/[0.06] dark:border-white/[0.06]">
          <p className="text-[10px] font-bold text-zinc-900 dark:text-zinc-100 leading-none">What is happening today?</p>
          <p className="text-[9.5px] leading-tight text-zinc-700 dark:text-zinc-300 mt-1 line-clamp-2">
            {narrative}
          </p>
          <p className="text-[8.5px] italic text-zinc-500 dark:text-zinc-400 mt-0.5 leading-none">
            {live ? "From live market feeds" : "Connecting to live feeds"}
          </p>
        </div>

        {/* Section 2: 3 notable changes */}
        <div className="pt-1.5">
          <p className="text-[9.5px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">3 notable changes</p>
          <div className="space-y-1 pt-1 text-[10px]">
            {items.map((it) => (
              <div key={it.label} className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300 truncate">
                  <span
                    className={cn(
                      "font-bold text-[9px] leading-none shrink-0",
                      it.up == null ? "text-zinc-400" : it.up ? "text-emerald-600 dark:text-mint-400" : "text-rose-600 dark:text-red-400"
                    )}
                  >
                    {it.up == null ? "•" : it.up ? "▲" : "▼"}
                  </span>
                  <span className="truncate">{it.label}</span>
                </span>
                <span
                  className={cn(
                    "mono font-bold shrink-0",
                    it.up == null ? "text-zinc-800 dark:text-zinc-200" : it.up ? "text-emerald-600 dark:text-mint-400" : "text-rose-600 dark:text-red-400"
                  )}
                >
                  {it.value}
                </span>
              </div>
            ))}
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
