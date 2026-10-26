"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { PostCardData } from "@/modules/community/components/PostCard";
import { DEMO_RESEARCH_POSTS } from "../lib/demo-posts";

export interface ResearchHeroProps {
  posts?: PostCardData[];
}

const SPOTLIGHT_CONFIG = [
  {
    pillar: "Market Insights",
    accentColor: "amber",
    badge: "PARALLEL EVM • 10K TPS",
    metrics: [
      { label: "Throughput", val: "10,480 TPS" },
      { label: "Finality", val: "800 ms" },
      { label: "State Access", val: "Optimistic" },
    ],
    colorHex: "#f59e0b",
    tag: "Execution Engine",
  },
  {
    pillar: "Token Analysis",
    accentColor: "emerald",
    badge: "ETHEREUM SCALING • L2 MATRIX",
    metrics: [
      { label: "Tracked TVL", val: "$48.2 B" },
      { label: "Rollups", val: "42 Tested" },
      { label: "Proof Cost", val: "-68% YoY" },
    ],
    colorHex: "#10b981",
    tag: "Rollups vs Validiums",
  },
  {
    pillar: "On-chain Data",
    accentColor: "purple",
    badge: "SOLANA TOKENOMICS • YIELD AUDIT",
    metrics: [
      { label: "Real Yield", val: "7.2% APY" },
      { label: "Inflation", val: "4.6% Dyn" },
      { label: "Staked Ratio", val: "66.4%" },
    ],
    colorHex: "#c084fc",
    tag: "Supply Dynamics",
  },
  {
    pillar: "Narrative Trends",
    accentColor: "indigo",
    badge: "AI SWARMS • INTENT-CENTRIC DEFI",
    metrics: [
      { label: "Swarm Bots", val: "2,400+ Live" },
      { label: "Paymaster", val: "100% 4337" },
      { label: "Rebalancing", val: "15s Auto" },
    ],
    colorHex: "#818cf8",
    tag: "Autonomous LLMs",
  },
];

export function ResearchHero({ posts }: ResearchHeroProps) {
  const source = posts && posts.length > 0 ? posts : DEMO_RESEARCH_POSTS;
  // Pick 4 latest research posts
  const postList = [
    source[0] || DEMO_RESEARCH_POSTS[0],
    source[1] || DEMO_RESEARCH_POSTS[1],
    source[2] || DEMO_RESEARCH_POSTS[2],
    source[3] || DEMO_RESEARCH_POSTS[3],
  ];

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-cycle through the 4 reports every 6 seconds unless user is hovering
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % 4);
    }, 6000);
    return () => clearInterval(interval);
  }, [isPaused]);

  const activePost = postList[activeIndex];
  const activeMeta = SPOTLIGHT_CONFIG[activeIndex];

  return (
    <section className="relative overflow-visible pt-6 pb-12 sm:pt-10 sm:pb-16 lg:pb-20">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -top-24 right-1/4 h-96 w-96 rounded-full bg-gold-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/2 left-[-10%] h-80 w-80 rounded-full bg-amber-500/10 blur-[140px]" />

      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8 xl:gap-12">
        {/* Left Column: Editorial Headline & Actions */}
        <div className="lg:col-span-6 xl:col-span-5">
          {/* Eyebrow Badge - Sculpted Neumorphic Pill */}
          <div className="neu-convex inline-flex items-center gap-2.5 rounded-full px-4 py-2 border border-white/[0.06] shadow-neu-sm">
            <span className="relative flex h-2.5 w-2.5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_10px_#f59e0b]" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200/90 [letter-spacing:0.12em]">
              RESEARCH & INTELLIGENCE HUB
            </span>
          </div>

          {/* Big Headline */}
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-5xl lg:text-[3.3rem] lg:leading-[1.12]">
            Web3 Research
            <br />
            <span className="bg-gradient-to-r from-amber-500 via-gold-500 to-amber-600 dark:from-amber-300 dark:via-gold-400 dark:to-amber-500 bg-clip-text text-transparent drop-shadow-[0_4px_12px_rgba(245,158,11,0.25)]">
              & Insights
            </span>
          </h1>

          {/* Subtitle / Description */}
          <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-lg">
            Deep dives, market intelligence, tokenomics and on-chain analytics from top analysts, sculpted in one tactile intelligence hub.
          </p>


        </div>

        {/* Right Column: 3D Holographic Display Visual on Neumorphic Pedestal */}
        <div className="relative lg:col-span-6 xl:col-span-7">
          {/* Expanded stage container with ample horizontal clearance */}
          <div className="relative mx-auto max-w-[620px] xl:max-w-[650px]">
            {/* Ambient gold glow behind visual */}
            <div className="pointer-events-none absolute -inset-4 rounded-full bg-gradient-to-tr from-gold-500/20 via-amber-500/10 to-transparent blur-3xl" />

            {/* Central Neumorphic Stage Frame (Clean dark ambient background, no bulky pedestal) */}
            <div className="neu-raised-lg relative aspect-auto sm:aspect-[4/3] w-full overflow-hidden rounded-3xl p-3 shadow-neu-lg">
              <div
                className="neu-frame relative h-full w-full overflow-hidden rounded-2xl bg-gradient-to-b from-[#0b0e17] via-[#080a11] to-[#05070c] flex items-center justify-center p-3 sm:p-4"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
              >
                {/* Ambient Gold Radial Glow in Center */}
                <div className="pointer-events-none absolute h-64 w-64 rounded-full bg-amber-500/10 blur-[100px]" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.06)_0%,transparent_75%)]" />

                {/* Subtle Technical Grid Lines */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.08]"
                  style={{
                    backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)`,
                    backgroundSize: "24px 24px",
                  }}
                />

                {/* ── CENTRAL ACTIVE HOLOGRAPHIC SPOTLIGHT CONSOLE (100% Centered) ── */}
                <div className="relative z-30 w-full max-w-[340px] sm:max-w-[370px] md:max-w-[390px] rounded-2xl border border-amber-400/40 bg-[#07090e]/95 backdrop-blur-xl p-3.5 sm:p-4 shadow-[0_16px_50px_rgba(0,0,0,0.8),0_0_35px_rgba(245,158,11,0.22),inset_0_1px_2px_rgba(255,255,255,0.15)] transition-all duration-300">
                  {/* Subtle scanning laser line */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-85 animate-pulse" />

                  {/* Holographic Header Bar */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
                      </span>
                      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-400">
                        {activeMeta.pillar} Spotlight
                      </span>
                    </div>

                    {/* Pillar Quick Selectors */}
                    <div className="flex items-center gap-1.5">
                      {SPOTLIGHT_CONFIG.map((cfg, idx) => (
                        <button
                          key={cfg.pillar}
                          onClick={() => setActiveIndex(idx)}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            activeIndex === idx ? "w-4 bg-amber-400 shadow-[0_0_8px_#f59e0b]" : "w-1.5 bg-zinc-600 hover:bg-zinc-400"
                          }`}
                          title={`Switch to ${cfg.pillar}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Active Report Title & Excerpt */}
                  <div className="mt-2.5">
                    <Link
                      href={`/research/${activePost.slug}`}
                      className="group/title block"
                      title={activePost.title}
                    >
                      <h3 className="line-clamp-2 text-xs sm:text-sm font-extrabold leading-snug text-white group-hover/title:text-amber-400 transition-colors drop-shadow-sm">
                        {activePost.title}
                      </h3>
                    </Link>
                    <p className="mt-1 line-clamp-2 text-[10px] sm:text-[11px] leading-relaxed text-zinc-300">
                      {activePost.excerpt}
                    </p>
                  </div>

                  {/* Holographic HUD Metrics Grid */}
                  <div className="mt-2.5 grid grid-cols-3 gap-1.5 sm:gap-2">
                    {activeMeta.metrics.map((m) => (
                      <div
                        key={m.label}
                        className="rounded-lg bg-white/[0.05] border border-white/[0.08] p-1.5 text-center"
                      >
                        <div className="text-[8px] sm:text-[9px] uppercase tracking-wider text-zinc-400 font-semibold truncate">
                          {m.label}
                        </div>
                        <div className="text-[10px] sm:text-[11px] font-bold text-amber-300 font-mono mt-0.5 truncate">
                          {m.val}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Link & Meta Footer */}
                  <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-[10px]">
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <span className="font-semibold text-zinc-200">{activePost.author?.name ? activePost.author.name.split(" ")[0] : "Analyst"}</span>
                      <span>•</span>
                      <span>{activePost.readMinutes || 8}m read</span>
                    </div>

                    <Link
                      href={`/research/${activePost.slug}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-2.5 py-1 text-[11px] font-bold text-amber-300 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                    >
                      <span>Read Report</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>

                {/* Bottom subtle indicator */}
                <div className="pointer-events-none absolute bottom-2.5 inset-x-0 text-center hidden sm:block">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-black/60 border border-white/10 px-3 py-0.5 text-[9px] sm:text-[10px] text-zinc-400 backdrop-blur-md shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Hover corners to inspect research streams</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Stream Selector: clean tactile touch targets to switch research streams */}
            <div className="mt-3.5 sm:hidden">
              <div className="grid grid-cols-2 gap-2">
                {SPOTLIGHT_CONFIG.map((cfg, idx) => {
                  const post = postList[idx];
                  const isSelected = activeIndex === idx;
                  const dotColors = [
                    "bg-amber-400 shadow-[0_0_8px_#f59e0b]",
                    "bg-emerald-400 shadow-[0_0_8px_#10b981]",
                    "bg-purple-400 shadow-[0_0_8px_#c084fc]",
                    "bg-indigo-400 shadow-[0_0_8px_#818cf8]",
                  ];
                  return (
                    <button
                      key={cfg.pillar}
                      type="button"
                      onClick={() => {
                        setActiveIndex(idx);
                        setIsPaused(true);
                      }}
                      className={`flex items-center gap-2 rounded-xl p-2.5 text-left transition-all border ${
                        isSelected
                          ? "border-amber-400/80 bg-amber-500/15 shadow-[0_0_12px_rgba(245,158,11,0.2)] ring-1 ring-amber-400/40"
                          : "border-white/10 bg-black/30 hover:border-white/20"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full shrink-0 ${dotColors[idx]}`} />
                      <div className="min-w-0 flex-1">
                        <div className={`text-[11px] font-bold truncate ${isSelected ? "text-amber-300" : "text-zinc-200"}`}>
                          {cfg.pillar}
                        </div>
                        <div className="text-[9px] text-zinc-400 truncate">
                          {post?.title || cfg.tag}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Floating Tile 1: Top-Left (Market Insights / Post 1) ── */}
            <div
              className="hidden sm:block"
              onMouseEnter={() => {
                setActiveIndex(0);
                setIsPaused(true);
              }}
              onMouseLeave={() => setIsPaused(false)}
            >
              <Link
                href={`/research/${postList[0].slug}`}
                className={`group neu-card absolute -left-2 sm:-left-8 md:-left-12 -top-2 sm:top-1 z-20 w-[140px] sm:w-[170px] md:w-[180px] rounded-2xl p-2 sm:p-2.5 shadow-neu transition-all duration-300 hover:-translate-y-1 hover:scale-[1.03] active:scale-[0.98] border ${
                  activeIndex === 0
                    ? "border-amber-400/80 ring-2 ring-amber-400/50 shadow-[0_8px_25px_rgba(245,158,11,0.35)]"
                    : "border-white/60 dark:border-white/[0.08] hover:border-amber-400/50"
                }`}
                title={postList[0].title}
              >
                <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">
                  <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider text-[8px] sm:text-[9px]">
                    Market Insights
                  </span>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
                  </span>
                </div>

                {/* Real Post Title */}
                <h4 className="mt-1 line-clamp-2 text-[10px] sm:text-[11px] font-bold leading-snug text-zinc-900 dark:text-zinc-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  {postList[0].title}
                </h4>

                {/* Iconic Wave Graphic Inset */}
                <div className="neu-inset-sm mt-1.5 rounded-xl p-1 h-6 sm:h-7 w-full overflow-hidden">
                  <svg viewBox="0 0 100 28" fill="none" className="h-full w-full overflow-visible">
                    <path
                      d="M 0,20 Q 15,9 30,16 T 60,10 T 85,5 T 100,12"
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 0,20 Q 15,9 30,16 T 60,10 T 85,5 T 100,12 L 100,28 L 0,28 Z"
                      fill="url(#yellowGlowHero)"
                      opacity="0.3"
                    />
                    <defs>
                      <linearGradient id="yellowGlowHero" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>

                {/* Meta footer with direct link */}
                <div className="mt-1 flex items-center justify-between text-[9px] text-zinc-500 dark:text-zinc-400">
                  <span className="truncate max-w-[80px] font-medium">
                    {postList[0].author?.name ? postList[0].author.name.split(" ")[0] : "Alpha"} • {postList[0].readMinutes || 8}m
                  </span>
                  <span className="inline-flex items-center gap-0.5 font-bold text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 group-active:translate-x-0.5 transition-transform">
                    {activeIndex === 0 ? "Active ⚡" : "Read ↗"}
                  </span>
                </div>
              </Link>
            </div>

            {/* ── Floating Tile 2: Bottom-Left (On-chain Data / Post 3) ── */}
            <div
              className="hidden sm:block"
              onMouseEnter={() => {
                setActiveIndex(2);
                setIsPaused(true);
              }}
              onMouseLeave={() => setIsPaused(false)}
            >
              <Link
                href={`/research/${postList[2].slug}`}
                className={`group neu-card absolute -left-2 sm:-left-8 md:-left-12 bottom-1 sm:bottom-2 z-20 w-[140px] sm:w-[170px] md:w-[180px] rounded-2xl p-2 sm:p-2.5 shadow-neu transition-all duration-300 hover:-translate-y-1 hover:scale-[1.03] active:scale-[0.98] border ${
                  activeIndex === 2
                    ? "border-purple-400/80 ring-2 ring-purple-400/50 shadow-[0_8px_25px_rgba(192,132,252,0.35)]"
                    : "border-white/60 dark:border-white/[0.08] hover:border-purple-400/50"
                }`}
                title={postList[2].title}
              >
                <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">
                  <span className="flex items-center gap-1 font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider text-[8px] sm:text-[9px]">
                    On-chain Data
                  </span>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-400 shadow-[0_0_8px_#c084fc]" />
                  </span>
                </div>

                {/* Real Post Title */}
                <h4 className="mt-1 line-clamp-2 text-[10px] sm:text-[11px] font-bold leading-snug text-zinc-900 dark:text-zinc-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  {postList[2].title}
                </h4>

                {/* Iconic On-Chain Equalizer Inset */}
                <div className="neu-inset-sm mt-1.5 flex h-6 sm:h-7 items-end justify-between gap-1.5 rounded-xl px-2 py-1">
                  <div className="w-2 rounded-t bg-purple-500/60 h-[45%]" />
                  <div className="w-2 rounded-t bg-purple-500/80 h-[65%]" />
                  <div className="w-2 rounded-t bg-purple-400 shadow-[0_0_6px_#c084fc] h-[85%]" />
                  <div className="w-2 rounded-t bg-purple-500/70 h-[50%]" />
                  <div className="w-2 rounded-t bg-purple-400 dark:bg-purple-300 shadow-[0_0_8px_#d8b4fe] h-[100%]" />
                  <div className="w-2 rounded-t bg-purple-500/90 h-[70%]" />
                </div>

                {/* Meta footer with direct link */}
                <div className="mt-1 flex items-center justify-between text-[9px] text-zinc-500 dark:text-zinc-400">
                  <span className="truncate max-w-[80px] font-medium">
                    {postList[2].author?.name ? postList[2].author.name.split(" ")[0] : "Desk"} • {postList[2].readMinutes || 9}m
                  </span>
                  <span className="inline-flex items-center gap-0.5 font-bold text-purple-600 dark:text-purple-400 group-hover:translate-x-0.5 group-active:translate-x-0.5 transition-transform">
                    {activeIndex === 2 ? "Active ⚡" : "Read ↗"}
                  </span>
                </div>
              </Link>
            </div>

            {/* ── Floating Tile 3: Top-Right (Token Analysis / Post 2) ── */}
            <div
              className="hidden sm:block"
              onMouseEnter={() => {
                setActiveIndex(1);
                setIsPaused(true);
              }}
              onMouseLeave={() => setIsPaused(false)}
            >
              <Link
                href={`/research/${postList[1].slug}`}
                className={`group neu-card absolute -right-2 sm:-right-8 md:-right-12 -top-2 sm:top-1 z-20 w-[140px] sm:w-[170px] md:w-[180px] rounded-2xl p-2 sm:p-2.5 shadow-neu transition-all duration-300 hover:-translate-y-1 hover:scale-[1.03] active:scale-[0.98] border ${
                  activeIndex === 1
                    ? "border-emerald-400/80 ring-2 ring-emerald-400/50 shadow-[0_8px_25px_rgba(16,185,129,0.35)]"
                    : "border-white/60 dark:border-white/[0.08] hover:border-emerald-400/50"
                }`}
                title={postList[1].title}
              >
                <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">
                  <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-[8px] sm:text-[9px]">
                    Token Analysis
                  </span>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  </span>
                </div>

                {/* Real Post Title */}
                <h4 className="mt-1 line-clamp-2 text-[10px] sm:text-[11px] font-bold leading-snug text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {postList[1].title}
                </h4>

                {/* Iconic Upward Trend Inset */}
                <div className="neu-inset-sm mt-1.5 rounded-xl p-1 h-6 sm:h-7 w-full overflow-hidden">
                  <svg viewBox="0 0 100 28" fill="none" className="h-full w-full overflow-visible">
                    <path
                      d="M 0,18 Q 20,22 40,12 T 75,8 T 100,3"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 0,18 Q 20,22 40,12 T 75,8 T 100,3 L 100,28 L 0,28 Z"
                      fill="url(#greenGlowHero)"
                      opacity="0.3"
                    />
                    <defs>
                      <linearGradient id="greenGlowHero" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>

                {/* Meta footer with direct link */}
                <div className="mt-1 flex items-center justify-between text-[9px] text-zinc-500 dark:text-zinc-400">
                  <span className="truncate max-w-[80px] font-medium">
                    {postList[1].author?.name ? postList[1].author.name.split(" ")[0] : "Analyst"} • {postList[1].readMinutes || 7}m
                  </span>
                  <span className="inline-flex items-center gap-0.5 font-bold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 group-active:translate-x-0.5 transition-transform">
                    {activeIndex === 1 ? "Active ⚡" : "Read ↗"}
                  </span>
                </div>
              </Link>
            </div>

            {/* ── Floating Tile 4: Bottom-Right (Narrative Trends / Post 4) ── */}
            <div
              className="hidden sm:block"
              onMouseEnter={() => {
                setActiveIndex(3);
                setIsPaused(true);
              }}
              onMouseLeave={() => setIsPaused(false)}
            >
              <Link
                href={`/research/${postList[3].slug}`}
                className={`group neu-card absolute -right-2 sm:-right-8 md:-right-12 bottom-1 sm:bottom-2 z-20 w-[140px] sm:w-[170px] md:w-[180px] rounded-2xl p-2 sm:p-2.5 shadow-neu transition-all duration-300 hover:-translate-y-1 hover:scale-[1.03] active:scale-[0.98] border ${
                  activeIndex === 3
                    ? "border-indigo-400/80 ring-2 ring-indigo-400/50 shadow-[0_8px_25px_rgba(129,140,248,0.35)]"
                    : "border-white/60 dark:border-white/[0.08] hover:border-indigo-400/50"
                }`}
                title={postList[3].title}
              >
                <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">
                  <span className="flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[8px] sm:text-[9px]">
                    Narrative Trends
                  </span>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400 shadow-[0_0_8px_#818cf8]" />
                  </span>
                </div>

                {/* Real Post Title */}
                <h4 className="mt-1 line-clamp-2 text-[10px] sm:text-[11px] font-bold leading-snug text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {postList[3].title}
                </h4>

                {/* Iconic Circular Arc & Bars Inset */}
                <div className="neu-inset-sm mt-1.5 flex items-center gap-2 rounded-xl p-1 px-2 h-6 sm:h-7">
                  <div className="relative h-4 w-4 sm:h-5 sm:w-5 shrink-0">
                    <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="rgba(168, 85, 247, 0.2)"
                        strokeWidth="4"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831"
                        fill="none"
                        stroke="#a855f7"
                        strokeWidth="4"
                        strokeDasharray="75, 100"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <div className="neu-inset-sm h-1 w-full overflow-hidden rounded-full bg-zinc-300 dark:bg-zinc-800">
                      <div className="h-full w-4/5 rounded-full bg-purple-500 shadow-[0_0_6px_#a855f7]" />
                    </div>
                    <div className="neu-inset-sm h-1 w-full overflow-hidden rounded-full bg-zinc-300 dark:bg-zinc-800">
                      <div className="h-full w-3/5 rounded-full bg-indigo-500 dark:bg-indigo-400 shadow-[0_0_6px_#818cf8]" />
                    </div>
                  </div>
                </div>

                {/* Meta footer with direct link */}
                <div className="mt-1 flex items-center justify-between text-[9px] text-zinc-500 dark:text-zinc-400">
                  <span className="truncate max-w-[80px] font-medium">
                    {postList[3].author?.name ? postList[3].author.name.split(" ")[0] : "AI Desk"} • {postList[3].readMinutes || 6}m
                  </span>
                  <span className="inline-flex items-center gap-0.5 font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 group-active:translate-x-0.5 transition-transform">
                    {activeIndex === 3 ? "Active ⚡" : "Read ↗"}
                  </span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
