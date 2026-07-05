"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState, useEffect } from "react";
import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";

/* ─── Marquee items ────────────────────────────────────────────────────── */
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
  "Blockchain",
];

/* ─── Animated stat counter ────────────────────────────────────────────── */
function Counter({ to, suffix }: { to: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const c = animate(count, to, { duration: 2.2, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [inView, count, to]);

  return (
    <span ref={ref} className="stat-num">
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  );
}

const stats = [
  { to: 6,   suffix: "+",  label: "Products building" },
  { to: 24,  suffix: "/7", label: "On-chain coverage" },
  { to: 100, suffix: "%",  label: "Community first" },
];

/* ─── Particles ────────────────────────────────────────────────────────── */
const particles = [
  { pos: "top-[16%] right-[12%]",    size: "h-1.5 w-1.5", delay: "0s",    dur: "6s"  },
  { pos: "top-[30%] left-[8%]",      size: "h-1 w-1",     delay: "1.2s",  dur: "8s"  },
  { pos: "bottom-[22%] right-[10%]", size: "h-1.5 w-1.5", delay: "0.6s",  dur: "7s"  },
  { pos: "bottom-[18%] left-[14%]",  size: "h-1 w-1",     delay: "2s",    dur: "9s"  },
  { pos: "top-[50%] right-[3%]",     size: "h-1 w-1",     delay: "1.5s",  dur: "10s" },
  { pos: "top-[8%] left-[18%]",      size: "h-0.5 w-0.5", delay: "3s",    dur: "7s"  },
  { pos: "bottom-[38%] left-[3%]",   size: "h-0.5 w-0.5", delay: "0.3s",  dur: "8s"  },
  { pos: "top-[66%] right-[20%]",    size: "h-1 w-1",     delay: "2.5s",  dur: "6s"  },
  { pos: "top-[42%] left-[26%]",     size: "h-0.5 w-0.5", delay: "1.8s",  dur: "11s" },
  { pos: "bottom-[10%] right-[28%]", size: "h-1 w-1",     delay: "0.9s",  dur: "7s"  },
];

/* ─── Clip-reveal line ─────────────────────────────────────────────────── */
function RevealLine({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <span className="clip-reveal">
      <motion.span
        className="block"
        initial={{ y: "110%" }}
        animate={{ y: "0%" }}
        transition={{ duration: 0.88, ease: [0.16, 1, 0.3, 1], delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}

export function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const [spotlight, setSpotlight] = useState({ x: 0, y: 0, active: false });

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const move = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      setSpotlight({ x: e.clientX - rect.left, y: e.clientY - rect.top, active: true });
    };
    const leave = () => setSpotlight((s) => ({ ...s, active: false }));
    el.addEventListener("mousemove", move);
    el.addEventListener("mouseleave", leave);
    return () => { el.removeEventListener("mousemove", move); el.removeEventListener("mouseleave", leave); };
  }, []);

  return (
    <section ref={heroRef} className="relative overflow-hidden pt-24 pb-0 sm:pt-32">

      {/* ── Ambient layers ─────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 bg-radial-fade" />
      <div className="pointer-events-none absolute inset-0 bg-grid" />
      <div className="hero-mesh" />
      <div className="noise-overlay" />

      {/* Drifting glow orbs */}
      <div className="glow-orb animate-orb-drift left-[4%] top-[2%] h-[520px] w-[520px] bg-gold-400/10" />
      <div className="glow-orb animate-orb-drift [animation-delay:4s] right-[1%] top-[8%] h-[640px] w-[640px] bg-gold-500/6" />
      <div className="glow-orb [animation-delay:8s] left-[40%] bottom-0 h-[300px] w-[300px] bg-gold-400/5" />

      {/* Mouse spotlight */}
      <div
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-600"
        style={{
          opacity: spotlight.active ? 1 : 0,
          background: `radial-gradient(800px circle at ${spotlight.x}px ${spotlight.y}px, rgba(233,160,32,0.06), transparent 65%)`,
        }}
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-28 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8">

        {/* ── Left: copy ──────────────────────────────────────────────── */}
        <div className="text-center lg:text-left">

          {/* Live badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
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

          {/* Headline — clip-reveal per line */}
          <h1 className="mt-7 font-display leading-[1.02] tracking-tight">
            <RevealLine delay={0.12}>
              <span className="text-4xl font-light text-zinc-400 sm:text-5xl lg:text-6xl">
                The home of
              </span>
            </RevealLine>
            <RevealLine delay={0.26}>
              <span className="text-gold-gradient text-5xl font-extrabold sm:text-7xl lg:text-[5.5rem]">
                next-gen
              </span>
            </RevealLine>
            <RevealLine delay={0.4}>
              <span className="text-4xl font-extrabold text-zinc-50 sm:text-6xl lg:text-7xl">
                Web3.
              </span>
            </RevealLine>
          </h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.55 }}
            className="mx-auto mt-7 max-w-lg text-[0.95rem] leading-[1.78] text-zinc-500 sm:text-base lg:mx-0"
          >
            Research, trading tools, a perp DEX, airdrop tools, premium
            intel and education — one ecosystem engineered for the
            builders, traders and degens of tomorrow.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.65 }}
            className="mt-10 flex flex-col items-center gap-3 sm:flex-row lg:justify-start"
          >
            <Link href="/signup" className="btn-gold w-full sm:w-auto">
              Get Early Access
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            <Link href="/research" className="btn-ghost w-full sm:w-auto">
              Explore Research
            </Link>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.78 }}
            className="mt-12 flex max-w-sm items-stretch lg:max-w-none"
          >
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={`stat-cell flex-1 px-5 text-center lg:text-left ${
                  i > 0 ? "border-l border-white/[0.07]" : ""
                } ${i === 0 ? "pl-0" : ""} ${i === stats.length - 1 ? "pr-0" : ""}`}
              >
                <div className="text-2xl font-bold text-gold-gradient sm:text-[1.8rem] transition-colors duration-300">
                  <Counter to={s.to} suffix={s.suffix} />
                </div>
                <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600">
                  {s.label}
                </div>
              </div>
            ))}
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 0.8 }}
            className="mt-10 hidden lg:flex items-center gap-2.5 text-zinc-700"
          >
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.22em]">Scroll</span>
              <svg
                className="animate-scroll-bounce"
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M7 10l5 5 5-5" />
              </svg>
            </div>
          </motion.div>
        </div>

        {/* ── Right: medallion ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto flex aspect-square w-full max-w-[400px] items-center justify-center"
        >
          {/* Rings */}
          <div className="absolute inset-0 animate-spin-slow rounded-full border border-gold-400/10" />
          <div className="absolute inset-7 animate-spin-rev rounded-full border border-dashed border-gold-400/14" />
          <div className="absolute inset-14 animate-spin-slow rounded-full border border-gold-300/8" />
          <div className="absolute inset-20 animate-spin-rev rounded-full border border-dashed border-gold-400/6" />

          {/* Core glow */}
          <div className="absolute inset-[22%] rounded-full bg-gold-400/12 blur-3xl" />
          <div className="absolute inset-[28%] rounded-full bg-gold-300/8 blur-2xl" />

          {/* Pulsing outer ring */}
          <div className="absolute inset-[8%] animate-pulse-ring rounded-full border border-gold-400/12" />

          {/* Logo */}
          <motion.div
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="relative h-[60%] w-[60%]"
          >
            <div className="absolute inset-0 rounded-full shadow-gold-xl opacity-50" />
            <Image
              src="/logo.jpg"
              alt="XYZ Crypto"
              fill
              priority
              className="rounded-full object-cover ring-1 ring-gold-400/50"
              sizes="(max-width: 768px) 60vw, 260px"
            />
          </motion.div>

          {/* Orbiting label */}
          <div className="absolute inset-0 animate-spin-slow" style={{ animationDuration: "20s" }}>
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-gold-400/30 bg-black/90 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-gold-200 shadow-gold-sm">
              WEB3
            </div>
          </div>

          {/* Particles */}
          {particles.map((p, i) => (
            <div
              key={i}
              className={`particle ${p.pos} ${p.size} bg-gold-400/55 animate-float-particle`}
              style={{ animationDelay: p.delay, animationDuration: p.dur }}
            />
          ))}
        </motion.div>
      </div>

      {/* ── Marquee ticker ───────────────────────────────────────────────── */}
      <div className="marquee-fade relative overflow-hidden border-y border-white/[0.04] py-3.5">
        <div className="marquee gap-10">
          {[...marqueeItems, ...marqueeItems].map((m, i) => (
            <span
              key={i}
              className="flex shrink-0 items-center gap-10 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-700 transition-colors hover:text-gold-600"
            >
              {m}
              <span className="text-gold-400/35">◆</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
