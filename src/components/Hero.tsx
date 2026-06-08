"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { site } from "@/lib/site";

const marquee = [
  "Web3 Research",
  "Perp DEX",
  "Trading Tools",
  "Airdrop Tools",
  "Premium Intel",
  "On-chain Alpha",
  "Web3 Academy",
  "DeFi",
];

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36">
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0 bg-radial-fade" />
      <div className="pointer-events-none absolute inset-0 bg-grid" />
      <div className="glow-orb left-[10%] top-[8%] h-72 w-72 bg-gold-600/30" />
      <div className="glow-orb right-[8%] top-[20%] h-80 w-80 bg-gold-400/20" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        {/* Left: copy */}
        <div className="text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/5 px-4 py-1.5 text-xs font-medium text-gold-100 lg:mx-0"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-300 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-gold-300" />
            </span>
            Next-Gen Web3 Ecosystem
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-7xl lg:text-8xl"
          >
            <span className="block text-zinc-100">The home of</span>
            <span className="block text-gold-gradient">next-gen</span>
            <span className="block text-zinc-100">Web3.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mx-auto mt-6 max-w-xl text-base text-zinc-400 sm:text-lg lg:mx-0"
          >
            Research, trading tools, a perp DEX, airdrop tools, premium
            intelligence & education — one ecosystem engineered for the
            builders, traders and degens of tomorrow.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:justify-start"
          >
            <Link href="/signup" className="btn-gold w-full sm:w-auto">
              Join the Movement
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link href="/research" className="btn-ghost w-full sm:w-auto">
              Explore Research
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-10 grid max-w-md grid-cols-3 gap-4 lg:max-w-none"
          >
            {[
              { k: "6+", v: "Products in pipeline" },
              { k: "24/7", v: "On-chain coverage" },
              { k: "100%", v: "Community first" },
            ].map((s) => (
              <div key={s.v} className="text-center lg:text-left">
                <div className="font-display text-2xl font-bold text-gold-gradient sm:text-3xl">
                  {s.k}
                </div>
                <div className="mt-1 text-xs text-zinc-500">{s.v}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right: animated logo medallion */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="relative mx-auto flex aspect-square w-full max-w-md items-center justify-center"
        >
          {/* rotating rings */}
          <div className="absolute inset-0 animate-spin-slow rounded-full border border-gold-500/20" />
          <div className="absolute inset-6 animate-spin-rev rounded-full border border-dashed border-gold-400/25" />
          <div className="absolute inset-12 animate-spin-slow rounded-full border border-gold-300/15" />

          {/* glow */}
          <div className="absolute inset-16 rounded-full bg-gold-500/20 blur-3xl" />

          {/* logo */}
          <motion.div
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="relative h-[68%] w-[68%]"
          >
            <div className="absolute inset-0 rounded-full shadow-gold" />
            <Image
              src="/logo.jpg"
              alt="XYZ Crypto logo"
              fill
              priority
              className="rounded-full object-cover ring-2 ring-gold-500/40"
              sizes="(max-width: 768px) 70vw, 320px"
            />
          </motion.div>

          {/* orbiting badge */}
          <div className="absolute inset-0 animate-spin-slow">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full border border-gold-500/40 bg-ink/90 px-3 py-1 text-[10px] font-semibold text-gold-100 shadow-gold-sm">
              WEB3
            </div>
          </div>
        </motion.div>
      </div>

      {/* marquee */}
      <div className="relative mt-16 overflow-hidden border-y border-white/5 py-4">
        <div className="marquee gap-8">
          {[...marquee, ...marquee].map((m, i) => (
            <span
              key={i}
              className="flex shrink-0 items-center gap-8 text-sm font-medium uppercase tracking-widest text-zinc-600"
            >
              {m}
              <span className="text-gold-500/60">✦</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
