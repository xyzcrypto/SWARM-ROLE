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
    <section className="relative overflow-hidden pt-24 pb-0 sm:pt-32">
      {/* Ambient layers */}
      <div className="pointer-events-none absolute inset-0 bg-radial-fade" />
      <div className="pointer-events-none absolute inset-0 bg-grid" />
      <div className="glow-orb left-[5%] top-[4%] h-[500px] w-[500px] bg-gold-400/14" />
      <div className="glow-orb right-[2%] top-[10%] h-[600px] w-[600px] bg-gold-500/9" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-24 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8">

        {/* ── Left: copy ─────────────────────────────────────────────── */}
        <div className="text-center lg:text-left">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="pill-gold">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-200 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold-200" />
              </span>
              Next-Gen Web3 Ecosystem
            </span>
          </motion.div>

          {/* Headline — locked production copy */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
            className="mt-7 font-display leading-[1.02] tracking-tight"
          >
            <span className="block text-4xl font-light text-zinc-400 sm:text-5xl lg:text-6xl">
              The home of
            </span>
            <span className="block text-gold-gradient text-5xl font-extrabold sm:text-7xl lg:text-[5.5rem]">
              next-gen
            </span>
            <span className="block text-4xl font-extrabold text-zinc-50 sm:text-6xl lg:text-7xl">
              Web3.
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.2 }}
            className="mx-auto mt-7 max-w-lg text-[0.95rem] leading-[1.75] text-zinc-500 sm:text-base lg:mx-0"
          >
            Research, trading tools, a perp DEX, airdrop tools, premium
            intel and education — one ecosystem engineered for the
            builders, traders and degens of tomorrow.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.3 }}
            className="mt-10 flex flex-col items-center gap-3 sm:flex-row lg:justify-start"
          >
            <Link href="/signup" className="btn-gold w-full sm:w-auto">
              Join the Movement
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            <Link href="/research" className="btn-ghost w-full sm:w-auto">
              Explore Research
            </Link>
          </motion.div>

          {/* Stats — JetBrains Mono numbers */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.46 }}
            className="mt-12 flex max-w-sm items-center divide-x divide-white/[0.07] lg:max-w-none"
          >
            {stats.map((s) => (
              <div key={s.v} className="flex-1 px-5 first:pl-0 last:pr-0 text-center lg:text-left">
                <div className="stat-num text-2xl font-bold text-gold-gradient sm:text-[1.75rem]">
                  {s.k}
                </div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                  {s.v}
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ── Right: medallion ────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto flex aspect-square w-full max-w-[400px] items-center justify-center"
        >
          {/* Concentric rings */}
          <div className="absolute inset-0 animate-spin-slow rounded-full border border-gold-400/10" />
          <div className="absolute inset-7 animate-spin-rev rounded-full border border-dashed border-gold-400/14" />
          <div className="absolute inset-14 animate-spin-slow rounded-full border border-gold-300/8" />
          <div className="absolute inset-20 animate-spin-rev rounded-full border border-dashed border-gold-400/6" />

          {/* Core glow */}
          <div className="absolute inset-[22%] rounded-full bg-gold-400/14 blur-3xl" />
          <div className="absolute inset-[28%] rounded-full bg-gold-300/10 blur-2xl" />

          {/* Floating logo */}
          <motion.div
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="relative h-[60%] w-[60%]"
          >
            <div className="absolute inset-0 rounded-full shadow-gold-xl opacity-60" />
            <Image
              src="/logo.jpg"
              alt="XYZ Crypto"
              fill
              priority
              className="rounded-full object-cover ring-1 ring-gold-400/50"
              sizes="(max-width: 768px) 60vw, 260px"
            />
          </motion.div>

          {/* Particle dots */}
          {[
            "top-[20%] right-[14%]",
            "top-[32%] left-[10%]",
            "bottom-[24%] right-[12%]",
            "bottom-[20%] left-[16%]",
            "top-[50%] right-[4%]",
          ].map((pos, i) => (
            <div
              key={i}
              className={`absolute ${pos} h-1 w-1 rounded-full bg-gold-400/50`}
            />
          ))}
        </motion.div>
      </div>

      {/* ── Marquee ticker ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-y border-white/[0.04] py-3.5">
        <div className="marquee gap-10">
          {[...marqueeItems, ...marqueeItems].map((m, i) => (
            <span
              key={i}
              className="flex shrink-0 items-center gap-10 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-700"
            >
              {m}
              <span className="text-gold-400/40">◆</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
