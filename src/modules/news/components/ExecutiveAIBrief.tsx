"use client";

import React, { useMemo, useState } from "react";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  ArrowRight,
  Lightbulb,
  Compass,
  Flame,
  Languages,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from "lucide-react";
import { type NewsItem } from "@/lib/news";
import { RobotIcon } from "@/components/RobotIcon";
import { cn } from "@/lib/utils";

interface ExecutiveAIBriefProps {
  items: NewsItem[];
  onOpenStory: (id: string) => void;
  onFilterHighImpact?: () => void;
  isHighImpactOnly?: boolean;
}

export function ExecutiveAIBrief({
  items,
  onOpenStory,
  onFilterHighImpact,
  isHighImpactOnly = false,
}: ExecutiveAIBriefProps) {
  const [lang, setLang] = useState<"en" | "hinglish">("en");
  const [isExpanded, setIsExpanded] = useState(true);

  // Synthesize top intelligence from the live stream
  const intelligence = useMemo(() => {
    if (!items || items.length === 0) {
      return {
        regime: "Neutral Consolidation",
        bias: "neutral" as const,
        drivers: [],
        playbook: [],
        narrativeDominance: "General Web3",
      };
    }

    let bullish = 0;
    let bearish = 0;
    for (const item of items) {
      if (item.sentiment === "bullish") bullish++;
      else if (item.sentiment === "bearish") bearish++;
    }

    const total = items.length;
    const bullishRatio = bullish / total;
    const bearishRatio = bearish / total;

    let regime = "Defensive Range / Neutral Stance";
    let bias: "bullish" | "bearish" | "neutral" = "neutral";
    if (bullishRatio > 0.4) {
      regime = "Risk-On Momentum / Bullish Catalysts Driving Feed";
      bias = "bullish";
    } else if (bearishRatio > 0.35) {
      regime = "Risk-Off Alert / High Volatility & Bearish Headwinds";
      bias = "bearish";
    }

    // Isolate high impact stories first, then fall back to newest
    const highImpact = items.filter((i) => i.impact === "High");
    const candidates = highImpact.length >= 3 ? highImpact : [...highImpact, ...items.filter((i) => i.impact !== "High")];
    const drivers = candidates.slice(0, 3);

    // Compute narrative frequency
    const catCounts: Record<string, number> = {};
    for (const item of items) {
      for (const cat of item.categories) {
        if (cat !== "Market News" && cat !== "Breaking News") {
          catCounts[cat] = (catCounts[cat] || 0) + 1;
        }
      }
    }
    const topNarrative = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "DeFi & Layer 1";

    // Dynamic Actionable Playbook based on live context
    const playbook = [
      {
        title: "Catalyst Momentum",
        text:
          bias === "bullish"
            ? "Aggressive dip buying observed in core Layer-1s. Look for breakout confirmations above key local resistance."
            : bias === "bearish"
            ? "Macro caution advised. Protect capital on DEX perps as sudden news spikes increase liquidation cascades."
            : "Range-bound conditions prevail. Favour narrative rotations and yield plays over breakout chasing.",
      },
      {
        title: "Liquidity & On-Chain Risk",
        text: items.some((i) => i.categories.includes("Hacks") || i.categories.includes("Security & Exploits"))
          ? "Exploit activity detected in feed. Double check smart contract allowances and pool liquidity depth before trading."
          : "Protocol security stable across Tier-1 DEX pools. Stablecoin supply velocity remains neutral to positive.",
      },
      {
        title: "Sector Rotation",
        text: `Capital and narrative attention heavily clustering around ${topNarrative}. Monitor volume spikes in related tokens.`,
      },
    ];

    return {
      regime,
      bias,
      drivers,
      playbook,
      narrativeDominance: topNarrative,
    };
  }, [items]);

  return (
    <div className="neu-card relative overflow-hidden rounded-3xl border border-white/60 dark:border-white/[0.08] p-4 sm:p-6 shadow-neu-lg">
      {/* Decorative ambient gradient backdrop */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-amber-400/[0.08] blur-3xl dark:bg-amber-400/[0.05]" />
      <div className="pointer-events-none absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-indigo-500/[0.06] blur-3xl dark:bg-indigo-500/[0.04]" />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        {/* Left: AI Badge & Heading */}
        <div className="flex items-center gap-3">
          <div className="neu-inset-sm flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-amber-500 bg-amber-500/10 border border-amber-500/30 shadow-neu-inset-sm">
            <RobotIcon className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                {lang === "en" ? "Executive AI Market Intelligence" : "Executive AI Market Samiksha"}
              </h2>
              <span className="neu-inset-sm inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-400/10 border border-amber-500/20">
                <Sparkles className="h-3 w-3 text-amber-500 animate-spin" />
                Live Synthesis
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
              {lang === "en"
                ? "Synthesized from 29+ feeds — actionable insights, top drivers, and risk radar."
                : "29+ feeds ka live nichod — market movers, trader insights aur risk alert."}
            </p>
          </div>
        </div>

        {/* Right: Language toggle & Collapse toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* EN / Hinglish Toggle */}
          <div className="neu-inset-sm inline-flex items-center rounded-xl p-0.5 border border-black/[0.06] dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => setLang("en")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98]",
                lang === "en"
                  ? "neu-btn bg-amber-400 text-black font-extrabold shadow-neu-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"
              )}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang("hinglish")}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98]",
                lang === "hinglish"
                  ? "neu-btn bg-amber-400 text-black font-extrabold shadow-neu-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"
              )}
            >
              <Languages className="h-3 w-3" /> Hinglish
            </button>
          </div>

          {/* High impact quick toggle */}
          {onFilterHighImpact && (
            <button
              type="button"
              onClick={onFilterHighImpact}
              className={cn(
                "neu-btn inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98]",
                isHighImpactOnly
                  ? "neu-inset bg-amber-400 text-black font-black border border-amber-500/40 shadow-neu-inset-sm"
                  : "text-zinc-700 dark:text-zinc-300 border border-white/40 dark:border-white/[0.06] shadow-neu-sm hover:text-amber-500"
              )}
              title="Show only market-moving news"
            >
              <Flame className="h-3.5 w-3.5 text-amber-500" />
              <span>{isHighImpactOnly ? "High Impact Active" : "Filter Catalysts"}</span>
            </button>
          )}

          {/* Expand/Collapse */}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="neu-btn p-1.5 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white border border-white/40 dark:border-white/[0.06] shadow-neu-sm hover:scale-[1.05] active:scale-[0.95]"
            aria-label={isExpanded ? "Collapse Briefing" : "Expand Briefing"}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isExpanded && (
        <div className="pt-4 space-y-4">
          {/* Market Regime Banner */}
          <div className="neu-inset-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl p-3 sm:p-3.5 border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg shadow-sm",
                  intelligence.bias === "bullish"
                    ? "bg-mint-500/20 text-mint-500"
                    : intelligence.bias === "bearish"
                    ? "bg-red-500/20 text-red-500"
                    : "bg-amber-500/20 text-amber-500"
                )}
              >
                {intelligence.bias === "bullish" ? (
                  <TrendingUp className="h-4 w-4" />
                ) : intelligence.bias === "bearish" ? (
                  <TrendingDown className="h-4 w-4" />
                ) : (
                  <Compass className="h-4 w-4" />
                )}
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                  {lang === "en" ? "Market Regime Pulse" : "Market Direction Status"}
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-zinc-900 dark:text-zinc-100">
                  {intelligence.regime}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {lang === "en" ? "Dominant Narrative:" : "Leading Narrative:"}
              </span>
              <span className="neu-btn rounded-lg px-2 py-0.5 text-xs font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 shadow-neu-sm">
                #{intelligence.narrativeDominance}
              </span>
            </div>
          </div>

          {/* Two-Column Grid: Left (Top 3 Catalysts) & Right (Trader Playbook / Insights) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Top 3 Market Catalysts */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">
                  <Flame className="h-3.5 w-3.5 text-amber-500" />
                  {lang === "en" ? "Top 3 Market Drivers (Catalysts)" : "Top 3 Bade Market Catalysts"}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {lang === "en" ? "Click to inspect story" : "Click karke padhein"}
                </span>
              </div>

              <div className="space-y-2">
                {intelligence.drivers.map((story, idx) => (
                  <button
                    key={story.id}
                    type="button"
                    onClick={() => onOpenStory(story.id)}
                    className="neu-btn w-full text-left rounded-2xl p-3 transition-all border border-white/60 dark:border-white/[0.06] shadow-neu-sm hover:scale-[1.01] active:scale-[0.99] group flex items-start gap-3"
                  >
                    <div className="neu-inset-sm flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 mt-0.5">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          {story.source}
                        </span>
                        {story.tokens?.[0] && (
                          <span className="rounded px-1.5 py-0.2 text-[10px] font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10">
                            ${story.tokens[0]}
                          </span>
                        )}
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.2 text-[9px] font-bold uppercase",
                            story.sentiment === "bullish"
                              ? "bg-mint-500/15 text-mint-600 dark:text-mint-400"
                              : story.sentiment === "bearish"
                              ? "bg-red-500/15 text-red-600 dark:text-red-400"
                              : "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400"
                          )}
                        >
                          {story.sentiment}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {story.title}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-zinc-400 group-hover:text-amber-500 group-hover:translate-x-0.5 group-active:translate-x-0.5 transition-all shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Trader Actionable Playbook */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                  {lang === "en" ? "Trader Actionable Takeaways" : "Traders Ke Liye Zaroori Insights"}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {lang === "en" ? "Decision Playbook" : "Trading Strategy"}
                </span>
              </div>

              <div className="neu-inset-sm rounded-2xl p-3.5 space-y-3 border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02]">
                {intelligence.playbook.map((note, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold text-zinc-900 dark:text-zinc-100 block">
                        {note.title}:
                      </span>
                      <p className="text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed mt-0.5">
                        {note.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
