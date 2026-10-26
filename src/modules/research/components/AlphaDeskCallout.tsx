"use client";

import Link from "next/link";
import { Send, Zap, Sparkles, ArrowRight } from "lucide-react";

export function AlphaDeskCallout() {
  return (
    <div className="neu-card col-span-full relative overflow-hidden rounded-3xl p-7 sm:p-9 shadow-neu-lg border border-gold-500/30">
      {/* Background radial accent glow */}
      <div className="pointer-events-none absolute -left-12 -top-12 h-64 w-64 rounded-full bg-gold-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -right-12 h-64 w-64 rounded-full bg-mint-500/10 blur-3xl" />

      <div className="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
        <div className="max-w-2xl space-y-2">
          <div className="neu-raised-sm inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-bold text-amber-800 dark:text-gold-300 border border-gold-500/30 bg-gold-500/15 dark:bg-ink-950/80 shadow-neu-sm">
            <Sparkles className="h-3.5 w-3.5 text-gold-400" />
            <span>XYZ Intelligence Desk</span>
          </div>

          <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Stay Ahead with Real-Time <span className="text-shine">On-Chain Alpha</span>
          </h3>

          <p className="text-sm sm:text-base text-zinc-700 dark:text-zinc-200 leading-relaxed font-normal">
            Direct notifications for protocol breakdowns, token generation events, perp yield opportunities, and institutional research reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3.5 shrink-0">
          <a
            href="https://t.me/X_Y_Z_Crypto"
            target="_blank"
            rel="noopener noreferrer"
            className="neu-btn-gold inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-neu-glow-gold active:scale-95"
          >
            <Send className="h-4 w-4" />
            <span>Join Alpha Telegram</span>
          </a>

          <Link
            href="/tools"
            className="neu-btn inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200 shadow-neu-sm hover:text-black dark:hover:text-white active:scale-95 group"
          >
            <Zap className="h-4 w-4 text-gold-400" />
            <span>Launch Tools</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 group-active:translate-x-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}
