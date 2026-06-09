"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { Container } from "./ui/primitives";
import { AnimatedBackground } from "./AnimatedBackground";

const ticker = [
  "Web3 Research",
  "Perp DEX",
  "Trading Tools",
  "Airdrop Tools",
  "Premium Intel",
  "On-chain Alpha",
  "Web3 Academy",
  "DeFi",
];

// Orbiting badges around the logo, anchored to the ring edges.
const orbitBadges = [
  { label: "WEB3", pos: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2", tone: "gold" },
  { label: "DEX", pos: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2", tone: "mint" },
  { label: "DEFI", pos: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2", tone: "gold" },
  { label: "ALPHA", pos: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2", tone: "mint" },
];

export function Hero({ memberCount = 0 }: { memberCount?: number }) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 120, damping: 14 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 120, damping: 14 });

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }
  function onLeave() {
    mx.set(0);
    my.set(0);
  }

  const members = memberCount > 0 ? memberCount.toLocaleString() : "—";

  return (
    <section className="relative overflow-hidden pt-24 pb-12 sm:pt-32 sm:pb-16 lg:pt-36">
      <AnimatedBackground />

      <Container className="relative grid items-center gap-10 sm:gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        {/* Copy */}
        <div className="text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 flex justify-center lg:justify-start"
          >
            <span className="eyebrow text-zinc-300">
              <Sparkles className="h-3.5 w-3.5 text-gold-300" />
              <span className="mono text-[11px] uppercase tracking-[0.16em]">
                The Home Of Next Gen Web3..
              </span>
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="font-display text-display-xl font-semibold text-zinc-50"
          >
            Everything you need
            <br />
            to <span className="text-gold-gradient">win in Web3.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg lg:mx-0"
          >
            Free Web3 research, pro trading tools, a perp DEX, airdrop tools and a
            free academy — one trusted ecosystem built for the next generation of
            traders, builders and degens.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24 }}
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start"
          >
            <Link href="/signup" className="btn-primary w-full sm:w-auto">
              Get early access
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/research" className="btn-ghost w-full sm:w-auto">
              Explore research
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.32 }}
            className="mt-6 flex items-center justify-center gap-2 text-xs text-zinc-500 lg:justify-start"
          >
            <ShieldCheck className="h-4 w-4 text-mint-400" />
            Free to join · No wallet required · Community first
          </motion.div>

          {/* live stats */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mx-auto mt-9 grid max-w-md grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:mx-0 lg:max-w-lg"
          >
            {[
              { k: members, v: "Members & growing" },
              { k: "6+", v: "Products in pipeline" },
              { k: "24/7", v: "On-chain coverage" },
            ].map((s) => (
              <div key={s.v} className="bg-ink-900 px-3 py-4 text-center sm:px-4 lg:text-left">
                <div className="mono text-xl font-semibold text-gold-gradient sm:text-2xl">{s.k}</div>
                <div className="mt-1 text-[10px] leading-tight text-zinc-500 sm:text-[11px]">{s.v}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Medallion */}
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          style={{ perspective: 1000 }}
          className="relative mx-auto flex aspect-square w-full max-w-[18rem] items-center justify-center sm:max-w-sm lg:max-w-md"
        >
          <motion.div
            style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
            className="relative flex h-full w-full items-center justify-center"
          >
            {/* rings — animate in on open */}
            <motion.div
              initial={{ scale: 0.3, opacity: 0, rotate: -50 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ duration: 0.9, delay: 0.1, ease: "easeOut" }}
              className="absolute inset-0 animate-spin-slow rounded-full border border-gold-500/25"
            />
            <motion.div
              initial={{ scale: 0.3, opacity: 0, rotate: 50 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ duration: 0.9, delay: 0.22, ease: "easeOut" }}
              className="absolute inset-6 animate-spin-rev rounded-full border border-dashed border-gold-400/30 sm:inset-7"
            />
            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.9, delay: 0.34, ease: "easeOut" }}
              className="absolute inset-12 animate-spin-slow rounded-full border border-mint-400/20 sm:inset-14"
            />
            <div className="absolute inset-16 animate-pulse-dot rounded-full bg-gold-500/20 blur-3xl" />

            {/* logo — pops in then floats */}
            <motion.div
              initial={{ scale: 0, rotate: -30, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.34, 1.56, 0.64, 1] }}
              style={{ transformStyle: "preserve-3d" }}
              className="relative h-[62%] w-[62%]"
            >
              <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                style={{ transform: "translateZ(60px)" }}
                className="relative h-full w-full"
              >
                <Image
                  src="/logo.jpg"
                  alt="XYZ Crypto"
                  fill
                  priority
                  className="rounded-full object-cover shadow-gold ring-2 ring-gold-500/40"
                  sizes="(max-width: 768px) 60vw, 300px"
                />
              </motion.div>
            </motion.div>

            {/* orbiting badges (WEB3 + more) — continuous rotation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="absolute inset-0"
              style={{ animation: "badge-orbit 22s linear infinite", transform: "translateZ(40px)" }}
            >
              {orbitBadges.map((b) => (
                <div key={b.label} className={`absolute ${b.pos}`}>
                  {/* counter-rotate to keep text upright while the ring spins */}
                  <div style={{ animation: "badge-orbit 22s linear infinite reverse" }}>
                    <span
                      className={`block rounded-full border bg-ink-900/90 px-2.5 py-1 mono text-[9px] font-semibold tracking-widest backdrop-blur sm:text-[10px] ${
                        b.tone === "mint"
                          ? "border-mint-500/40 text-mint-200"
                          : "border-gold-500/40 text-gold-100"
                      }`}
                    >
                      {b.label}
                    </span>
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      </Container>

      {/* ticker */}
      <div className="marquee-mask relative mt-10 overflow-hidden border-y border-line py-4 sm:mt-14">
        <div className="marquee gap-8">
          {[...ticker, ...ticker].map((m, i) => (
            <span
              key={i}
              className="mono flex shrink-0 items-center gap-8 text-xs uppercase tracking-[0.2em] text-zinc-600"
            >
              {m}
              <span className="text-gold-500/50">✦</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
