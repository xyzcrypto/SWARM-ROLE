"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { Container } from "./ui/primitives";

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

export function Hero({ memberCount = 0 }: { memberCount?: number }) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), { stiffness: 120, damping: 14 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), { stiffness: 120, damping: 14 });

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
    <section className="relative overflow-hidden pt-32 sm:pt-40">
      <div className="mesh" />
      <div className="grid-bg" />
      <div className="grain" />

      <Container className="relative grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
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
                Next-Gen Web3 Ecosystem
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
            className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-zinc-400 lg:mx-0"
          >
            Free Web3 research, pro trading tools, a perp DEX, airdrop tools and a
            free academy — one trusted ecosystem built for the next generation of
            traders, builders and degens.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:justify-start"
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
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-7 flex items-center justify-center gap-2 text-xs text-zinc-500 lg:justify-start"
          >
            <ShieldCheck className="h-4 w-4 text-mint-400" />
            Free to join · No wallet required · Community first
          </motion.div>

          {/* live stats */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.38 }}
            className="mt-10 grid max-w-md grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:max-w-lg"
          >
            {[
              { k: members, v: "Members & growing" },
              { k: "6+", v: "Products in pipeline" },
              { k: "24/7", v: "On-chain coverage" },
            ].map((s) => (
              <div key={s.v} className="bg-ink-900 px-4 py-4 text-center lg:text-left">
                <div className="mono text-2xl font-semibold text-gold-gradient">{s.k}</div>
                <div className="mt-1 text-[11px] leading-tight text-zinc-500">{s.v}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Medallion */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          style={{ perspective: 1000 }}
          className="relative mx-auto flex aspect-square w-full max-w-sm items-center justify-center sm:max-w-md"
        >
          <motion.div
            style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
            className="relative flex h-full w-full items-center justify-center"
          >
            <div className="absolute inset-0 animate-spin-slow rounded-full border border-gold-500/20" />
            <div className="absolute inset-7 animate-spin-rev rounded-full border border-dashed border-gold-400/25" />
            <div className="absolute inset-14 animate-spin-slow rounded-full border border-mint-400/15" />
            <div className="absolute inset-16 rounded-full bg-gold-500/20 blur-3xl" />

            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              style={{ transform: "translateZ(60px)" }}
              className="relative h-[64%] w-[64%]"
            >
              <Image
                src="/logo.jpg"
                alt="XYZ Crypto"
                fill
                priority
                className="rounded-full object-cover shadow-gold ring-2 ring-gold-500/40"
                sizes="(max-width: 768px) 64vw, 300px"
              />
            </motion.div>

            <div className="absolute inset-0 animate-spin-slow" style={{ transform: "translateZ(30px)" }}>
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full border border-gold-500/40 bg-ink-900/90 px-2.5 py-1 mono text-[10px] font-semibold tracking-widest text-gold-100">
                WEB3
              </div>
            </div>
          </motion.div>
        </motion.div>
      </Container>

      {/* ticker */}
      <div className="marquee-mask relative mt-20 overflow-hidden border-y border-line py-4">
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
