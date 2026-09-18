"use client";

import { useState } from "react";
import { ArrowRight, Check, Send } from "lucide-react";

export function HowItWorksCard() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && email.includes("@")) {
      setSubscribed(true);
    }
  };

  return (
    <div className="flex flex-col justify-between gap-5">
      {/* 1. How It Works Box */}
      <div className="rounded-2xl border border-hairline bg-surface-2 p-5 sm:p-6">
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
            <div className="text-[10px] font-bold text-gold-400">01</div>
            <div className="mt-1 font-display text-xs font-bold text-content">Enter Your Points</div>
            <div className="mt-1 text-[11px] text-content-subtle leading-tight">
              Input your earned points for any program
            </div>
          </div>

          <div className="rounded-xl border border-hairline bg-base p-3">
            <div className="text-[10px] font-bold text-gold-400">02</div>
            <div className="mt-1 font-display text-xs font-bold text-content">Set Assumptions</div>
            <div className="mt-1 text-[11px] text-content-subtle leading-tight">
              Adjust allocation, FDV and parameters
            </div>
          </div>

          <div className="rounded-xl border border-hairline bg-base p-3">
            <div className="text-[10px] font-bold text-gold-400">03</div>
            <div className="mt-1 font-display text-xs font-bold text-content">Analyze Results</div>
            <div className="mt-1 text-[11px] text-content-subtle leading-tight">
              Get instant value estimates and net ROI
            </div>
          </div>

          <div className="rounded-xl border border-hairline bg-base p-3">
            <div className="text-[10px] font-bold text-gold-400">04</div>
            <div className="mt-1 font-display text-xs font-bold text-content">Make Decisions</div>
            <div className="mt-1 text-[11px] text-content-subtle leading-tight">
              Compare scenarios & optimize strategy
            </div>
          </div>
        </div>
      </div>

      {/* 2. Stay Ahead in Airdrops (Newsletter Card) */}
      <div className="relative overflow-hidden rounded-2xl border border-gold-500/30 bg-gradient-to-r from-amber-950/30 via-surface-2 to-base p-5 sm:p-6 shadow-xl">
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gold-500/20 text-gold-300">
              <Send className="h-3.5 w-3.5" />
            </span>
            <div>
              <h3 className="font-display text-base font-bold text-content">
                Stay Ahead in Airdrops
              </h3>
              <p className="text-xs text-content-muted">
                Get the latest insights, new program alerts and expert analysis.
              </p>
            </div>
          </div>

          {subscribed ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-300">
              <Check className="h-4 w-4" />
              <span>You&apos;re in! Check your inbox for the latest intelligence briefs.</span>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 rounded-xl border border-hairline bg-base px-3.5 py-2 text-xs font-medium text-content outline-none focus:border-gold-500/60"
                required
              />
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-gold-400 to-amber-500 px-5 py-2 text-xs font-bold text-black transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Subscribe
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
