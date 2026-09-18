"use client";

import { ArrowRight, BarChart2, CheckCircle2, Flame, Layers, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";

interface PointsHeroProps {
  onExplore?: () => void;
  onPortfolio?: () => void;
}

export function PointsHero({ onExplore, onPortfolio }: PointsHeroProps) {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-hairline bg-gradient-to-b from-surface-2 via-surface-2 to-base p-6 sm:p-8 lg:p-10">
      {/* Background ambient radial glows */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-1/4 h-80 w-80 rounded-full bg-gold-400/5 blur-3xl" />

      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-8">
        {/* Left Column: Headline & Action */}
        <div className="lg:col-span-7 space-y-6">
          {/* Tag badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-3.5 py-1 text-[11px] font-semibold tracking-wider text-gold-300 uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Airdrop Farming
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h1 className="font-display text-4xl font-bold tracking-tight text-content sm:text-5xl lg:text-6xl">
              Points <span className="text-shine">Intelligence</span>
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-content-muted sm:text-base">
              Track points, estimate value, calculate farming costs and make smarter decisions across all major airdrop programs.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => (onExplore ? onExplore() : scrollTo("featured-programs"))}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-gold-400 via-gold-500 to-amber-500 px-6 py-2.5 text-xs font-bold text-black shadow-lg shadow-gold-500/20 transition-all hover:scale-[1.02] hover:shadow-gold-500/30 active:scale-[0.98]"
            >
              Explore Programs
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => (onPortfolio ? onPortfolio() : scrollTo("my-airdrops"))}
              className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-2 px-5 py-2.5 text-xs font-semibold text-content transition-all hover:border-gold-500/30 hover:bg-white/5 active:scale-[0.98]"
            >
              <BarChart2 className="h-3.5 w-3.5 text-gold-400" />
              My Portfolio
            </button>
          </div>

          {/* 4 Stats in a clean horizontal row */}
          <div className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-4 sm:gap-6 border-t border-hairline">
            <div>
              <div className="font-display text-2xl font-bold tracking-tight text-content">25+</div>
              <div className="text-[11px] text-content-subtle">Tracked Protocols</div>
            </div>
            <div>
              <div className="mono text-2xl font-bold tracking-tight text-content">$12.4M+</div>
              <div className="text-[11px] text-content-subtle">Points Analyzed</div>
            </div>
            <div>
              <div className="font-display text-2xl font-bold tracking-tight text-content">50K+</div>
              <div className="text-[11px] text-content-subtle">Active Users</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-display text-2xl font-bold tracking-tight text-content">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Real-time
              </div>
              <div className="text-[11px] text-content-subtle">Data Updates</div>
            </div>
          </div>
        </div>

        {/* Right Column: Sleek Cosmic Graphic Card */}
        <div className="lg:col-span-5">
          <div className="relative overflow-hidden rounded-2xl border border-gold-500/20 bg-gradient-to-b from-black/80 to-surface-2 p-5 shadow-2xl">
            {/* Background Image / Ambient Glow */}
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-white/5 bg-black">
              <img
                src="/images/points-hero.jpg"
                alt="Points Intelligence Cosmic Token"
                className="h-full w-full object-cover opacity-90 transition-transform duration-700 hover:scale-105 active:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

              {/* Floating Quote */}
              <div className="absolute top-3 left-3 text-right">
                <span className="font-serif italic text-xs tracking-wide text-gold-200/90 drop-shadow-md">
                  "More than points. A bigger tomorrow."
                </span>
              </div>

              {/* 3 Floating Feature Badges */}
              <div className="absolute bottom-3 inset-x-3 space-y-1.5">
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <span className="grid h-5 w-5 place-items-center rounded-md bg-gold-500/20 text-[11px] text-gold-300">
                      🌾
                    </span>
                    <span className="text-xs font-semibold text-content">Earn</span>
                  </div>
                  <span className="text-[10px] text-content-subtle">Farm points across ecosystems</span>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <span className="grid h-5 w-5 place-items-center rounded-md bg-gold-500/20 text-[11px] text-gold-300">
                      📈
                    </span>
                    <span className="text-xs font-semibold text-content">Analyze</span>
                  </div>
                  <span className="text-[10px] text-content-subtle">Real-time value estimation</span>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <span className="grid h-5 w-5 place-items-center rounded-md bg-gold-500/20 text-[11px] text-gold-300">
                      🛡️
                    </span>
                    <span className="text-xs font-semibold text-content">Decide</span>
                  </div>
                  <span className="text-[10px] text-content-subtle">Make informed choices</span>
                </div>
              </div>
            </div>

            {/* Bottom edge teaser */}
            <div className="mt-3 flex items-center justify-between rounded-xl border border-gold-500/30 bg-gold-500/10 px-3.5 py-2">
              <span className="text-xs font-semibold text-gold-200">
                Build your edge in the next bull run.
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-gold-300" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
