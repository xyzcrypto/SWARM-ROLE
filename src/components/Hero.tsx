"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

const marqueeItems = [
  "Web3 Research",
  "Perp DEX",
  "Trading Tools",
  "Airdrop Tools",
  "Premium Intel",
  "On-chain Alpha",
  "Web3 Academy",
  "DeFi",
  "TradeKaroVerse",
];

const stats = [
  { k: "6+",    v: "Products in pipeline" },
  { k: "24/7",  v: "On-chain coverage" },
  { k: "100%",  v: "Community first" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-0 sm:pt-36">
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0 bg-radial-fade" />
      <div className="pointer-events-none absolute inset-0 bg-grid" />
      <div className="glow-orb left-[8%] top-[6%] h-80 w-80 bg-gold-600/25" />
      <div className="glow-orb right-[6%] top-[18%] h-96 w-96 bg-gold-400/15" />
      <div className="glow-orb left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 bg-gold-500/8" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:px-8">

        {/* ── Left: copy ─────────────────────────────────────────────── */}
        <div className="text-center lg:text-left">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <span className="pill-gold">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-300 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold-300" />
              </span>
              Next-Gen Web3 Ecosystem
            </span>
          </motion.div>

          {/* Headline — locked to production reference */}
          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.07 }}
            className="mt-6 font-display text-5xl font-extrabold leading-[1.04] tracking-tight sm:text-7xl lg:text-[5.25rem]"
          >
            <span className="block text-zinc-100">The home of</span>
            <span className="block text-gold-gradient">next-gen</span>
            <span className="block text-zinc-100">Web3.</span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.17 }}
            className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-zinc-400 sm:text-lg lg:mx-0"
          >
            Research, trading tools, a perp DEX, airdrop tools, premium
            intel and education — one ecosystem engineered for the
            builders, traders and degens of tomorrow.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.27 }}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:justify-start"
          >
            <Link href="/signup" className="btn-gold w-full sm:w-auto">
              Join the Movement
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            <Link href="/research" className="btn-ghost w-full sm:w-auto">
              Explore Research
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.42 }}
            className="mt-12 flex max-w-md items-center divide-x divide-white/[0.08] lg:max-w-none"
          >
            {stats.map((s) => (
              <div key={s.v} className="flex-1 px-5 first:pl-0 last:pr-0 text-center lg:text-left">
                <div className="font-display text-2xl font-bold text-gold-gradient sm:text-3xl">
                  {s.k}
                </div>
                <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                  {s.v}
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ── Right: logo medallion ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto flex aspect-square w-full max-w-[420px] items-center justify-center"
        >
          {/* Outer rings */}
          <div className="absolute inset-0 animate-spin-slow rounded-full border border-gold-500/15" />
          <div className="absolute inset-5 animate-spin-rev rounded-full border border-dashed border-gold-400/20" />
          <div className="absolute inset-10 animate-spin-slow rounded-full border border-gold-300/10" />
          <div className="absolute inset-16 animate-spin-rev rounded-full border border-dashed border-gold-500/8" />

          {/* Glow cores */}
          <div className="absolute inset-20 rounded-full bg-gold-500/18 blur-3xl" />
          <div className="absolute inset-24 rounded-full bg-gold-400/12 blur-2xl" />

          {/* Floating logo */}
          <motion.div
            animate={{ y: [0, -16, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            className="relative h-[64%] w-[64%]"
          >
            <div className="absolute inset-0 rounded-full shadow-gold-lg" />
            <Image
              src="/logo.jpg"
              alt="XYZ Crypto"
              fill
              priority
              className="rounded-full object-cover ring-2 ring-gold-500/45"
              sizes="(max-width: 768px) 65vw, 300px"
            />
          </motion.div>

          {/* Orbiting WEB3 badge */}
          <div className="absolute inset-0 animate-spin-slow">
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full border border-gold-500/40 bg-ink/90 px-3.5 py-1 text-[10px] font-bold tracking-widest text-gold-100 shadow-gold-sm backdrop-blur-sm">
              WEB3
            </div>
          </div>

          {/* Counter-orbiting badge */}
          <div className="absolute inset-0 animate-spin-rev">
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-gold-600/30 bg-ink/90 px-3 py-0.5 text-[9px] font-bold tracking-widest text-gold-600 backdrop-blur-sm">
              DEFI
            </div>
          </div>

          {/* Corner particle dots */}
          {[
            "top-[18%] right-[12%]",
            "top-[28%] left-[8%]",
            "bottom-[22%] right-[10%]",
            "bottom-[18%] left-[14%]",
          ].map((pos, i) => (
            <div
              key={i}
              className={`absolute ${pos} h-1.5 w-1.5 rounded-full bg-gold-400/60`}
              style={{ animationDelay: `${i * 0.4}s` }}
            />
          ))}
        </motion.div>
      </div>

      {/* ── Marquee ticker ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-y border-white/[0.05] py-4">
        <div className="marquee gap-10">
          {[...marqueeItems, ...marqueeItems].map((m, i) => (
            <span
              key={i}
              className="flex shrink-0 items-center gap-10 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-700"
            >
              {m}
              <span className="text-gold-500/50">◆</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
