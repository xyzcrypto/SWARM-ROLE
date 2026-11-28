"use client";

import { ArrowRight } from "lucide-react";

export function HowItWorksCard() {
  return (
    <div className="rounded-2xl border border-hairline bg-surface-2 p-5 sm:p-6 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-hairline">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-content sm:text-xl">
              How It Works
            </h2>
            <p className="text-xs text-content-muted">
              Get started in 4 simple steps
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              const el = document.getElementById("featured-programs");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            className="group flex items-center gap-1.5 text-xs font-semibold text-gold-400 hover:text-gold-300 transition-colors"
          >
            View Guide
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-active:translate-x-0.5" />
          </button>
        </div>

        {/* 4 Steps Grid */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-xl border border-hairline bg-base p-3">
            <div className="text-[0.625rem] font-bold text-gold-400">01</div>
            <div className="mt-1 font-display text-xs font-bold text-content">Enter Your Points</div>
            <div className="mt-1 text-[0.6875rem] text-content-subtle leading-tight">
              Input your earned points for any program
            </div>
          </div>

          <div className="rounded-xl border border-hairline bg-base p-3">
            <div className="text-[0.625rem] font-bold text-gold-400">02</div>
            <div className="mt-1 font-display text-xs font-bold text-content">Set Assumptions</div>
            <div className="mt-1 text-[0.6875rem] text-content-subtle leading-tight">
              Adjust allocation, FDV and parameters
            </div>
          </div>

          <div className="rounded-xl border border-hairline bg-base p-3">
            <div className="text-[0.625rem] font-bold text-gold-400">03</div>
            <div className="mt-1 font-display text-xs font-bold text-content">Analyze Results</div>
            <div className="mt-1 text-[0.6875rem] text-content-subtle leading-tight">
              Get instant value estimates and net ROI
            </div>
          </div>

          <div className="rounded-xl border border-hairline bg-base p-3">
            <div className="text-[0.625rem] font-bold text-gold-400">04</div>
            <div className="mt-1 font-display text-xs font-bold text-content">Make Decisions</div>
            <div className="mt-1 text-[0.6875rem] text-content-subtle leading-tight">
              Compare scenarios & optimize strategy
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
