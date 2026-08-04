"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { MagicStar } from "iconsax-react";
import { Container } from "./ui/primitives";
import { AnimatedBackground } from "./AnimatedBackground";
import { Starfield } from "./Starfield";
import { HeroCta, type HeroResearch } from "./HeroCta";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

// One chunk of the hero headline, revealed in its own staggered beat (blur ->
// focus, rise -> settle) so the line reads as a deliberate cascade landing
// into place rather than the whole headline fading in as one block.
// The stagger is a CSS custom property rather than a framer-motion `delay`, so
// the words are painted by the browser instead of by the bundle. See the
// "Hero entrance" block in globals.css for why that distinction is the whole
// point: a motion `initial` ships as style="opacity:0" and the headline then
// waits for hydration.
function HeroWord({ children, i, className }: { children: ReactNode; i: number; className?: string }) {
  return (
    <span
      style={{ "--rise-delay": `${0.05 + i * 0.1}s` } as React.CSSProperties}
      className={cn("hero-word", className)}
    >
      {children}
    </span>
  );
}

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
  { label: "WEB3", tone: "gold" },
  { label: "PERP DEX", tone: "mint" },
  { label: "DEFI", tone: "gold" },
  { label: "NFT", tone: "violet" },
  { label: "RWA", tone: "mint" },
  { label: "ALPHA", tone: "gold" },
  { label: "DEX", tone: "violet" },
];

const toneClass: Record<string, string> = {
  gold: "border-gold-500/45 text-gold-100 shadow-[0_0_18px_-4px_rgba(226,167,47,0.6)]",
  mint: "border-mint-500/45 text-mint-200 shadow-[0_0_18px_-4px_rgba(11,187,124,0.6)]",
  violet: "border-violet-500/45 text-violet-200 shadow-[0_0_18px_-4px_rgba(139,92,246,0.6)]",
};

export function Hero({ memberCount = 0, research }: { memberCount?: number; research: HeroResearch }) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 120, damping: 14 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 120, damping: 14 });

  // rAF-throttled: high-Hz mice fire mousemove 120+/s; one layout read +
  // spring update per frame is all the eye can use.
  const moveRaf = useRef(0);
  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    // Respect reduced-motion: skip the 3D parallax spring entirely.
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (moveRaf.current) return;
    const el = e.currentTarget;
    const { clientX, clientY } = e;
    moveRaf.current = requestAnimationFrame(() => {
      moveRaf.current = 0;
      const r = el.getBoundingClientRect();
      mx.set((clientX - r.left) / r.width - 0.5);
      my.set((clientY - r.top) / r.height - 0.5);
    });
  }
  function onLeave() {
    if (moveRaf.current) {
      cancelAnimationFrame(moveRaf.current);
      moveRaf.current = 0;
    }
    mx.set(0);
    my.set(0);
  }

  const members = "50K+";

  return (
    <section className="sect-cv relative overflow-hidden pt-24 pb-12 sm:pt-32 sm:pb-16 lg:pt-36">
      <AnimatedBackground />
      {/* deep-space starfield, same as the orbital section - ties the top of the
          page together and gives the hero a premium "space" depth on all sizes.
          Drifting stars + meteors make it feel alive; Saturn + Moon live only in
          the orbital section so they never collide with the medallion. */}
      <Starfield className="opacity-80" bodies={false} />

      <Container className="relative grid items-center gap-10 sm:gap-12 lg:min-h-[76vh] lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 2xl:gap-20">
        {/* Copy */}
        <div className="text-center lg:text-left">
          <div
            style={{ "--rise-y": "12px", "--rise-dur": "0.5s" } as React.CSSProperties}
            className="hero-rise mb-6 flex justify-center lg:justify-start"
          >
            <span className="eyebrow eyebrow-glass text-zinc-200">
              <MagicStar size={14} variant="Bold" color="#e2a72f" />
              <span className="mono text-[10px] uppercase tracking-[0.08em] sm:text-[11px] sm:tracking-[0.16em]">
                The Home Of Next Gen Web3..
              </span>
            </span>
          </div>

          <h1
            style={{ fontFamily: "var(--font-fraunces)" }}
            className="text-display-xl font-semibold lg:whitespace-nowrap lg:text-[2.5rem] lg:leading-[1.1] xl:text-[3.15rem] 2xl:text-[3.6rem]"
          >
            {/* .text-shimmer is applied per-word (not on the <h1> itself) - background-clip:text
                only clips to an element's OWN text, not text inside nested inline children, so
                putting it on the wrapper alone left every word except the last invisible. */}
            <HeroWord i={0} className="text-shimmer">Everything</HeroWord>{" "}
            <HeroWord i={1} className="text-shimmer">you</HeroWord>{" "}
            <HeroWord i={2} className="text-shimmer">need</HeroWord>
            <br />
            <HeroWord i={3} className="text-shimmer">to</HeroWord>{" "}
            <HeroWord i={4}>
              <span className="text-shine">win in Web3.</span>
            </HeroWord>
          </h1>

          {/* This paragraph is the page's LCP element. It was the single worst
              offender: as a motion.p it left the largest block of text on the
              site at opacity 0 until hydration finished. */}
          <p
            style={{ "--rise-dur": "0.6s", "--rise-delay": "0.12s" } as React.CSSProperties}
            className="hero-rise mx-auto mt-4 max-w-md text-balance text-[15px] leading-relaxed text-zinc-400 sm:mt-5 sm:max-w-xl sm:text-lg lg:mx-0 lg:max-w-[580px]"
          >
            On-chain research, pro trading tools, a perpetual DEX, airdrop
            intelligence and a free academy, the complete Web3 toolkit, built
            for the next generation of traders and builders.
          </p>

          {/* Card + one secondary row + a quiet trust line. Replaces the two
              stacked buttons and the separate trust sentence that used to sit
              here; see HeroCta for why the card is a column. */}
          <HeroCta research={research} />

          {/* live stats */}
          <div
            style={{ "--rise-y": "16px", "--rise-dur": "0.7s", "--rise-delay": "0.4s" } as React.CSSProperties}
            className="hero-rise mx-auto mt-8 grid max-w-md grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:mx-0 lg:max-w-[580px]"
          >
            {[
              { k: members, v: "Overall social community" },
              { k: "6+", v: "Products in pipeline" },
              { k: "24/7", v: "On-chain coverage" },
            ].map((s) => (
              <div key={s.v} className="relative bg-ink-900/90 px-3 py-4 text-center transition-colors hover:bg-ink-800 sm:px-4 lg:text-left">
                <div className="mono text-shine text-xl font-semibold sm:text-2xl">{s.k}</div>
                <div className="mt-1 text-[10px] leading-tight text-zinc-500 sm:text-[11px]">{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Medallion. Its entrance is CSS too. Fixing only the copy was not
            enough: with the text painting immediately, the logo <Image> became
            the new LCP element at 5036ms, because these two wrappers still
            shipped at opacity 0. The parallax springs stay on framer-motion -
            they live on the INNER div, which no CSS animation touches, so the
            two never write transform on the same element. */}
        <div
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          style={{ perspective: 1000, "--pop-from": "0.7" } as React.CSSProperties}
          className="hero-pop relative mx-auto flex aspect-square w-full max-w-[15rem] items-center justify-center xs:max-w-[17rem] sm:max-w-sm lg:max-w-md xl:max-w-lg 2xl:max-w-xl"
        >
          <motion.div
            style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
            className="relative flex h-full w-full items-center justify-center"
          >
            {/* rings, animate in on open */}
            <div
              style={{ "--pop-delay": "0.1s" } as React.CSSProperties}
              className="hero-fade absolute inset-0 animate-spin-slow rounded-full border border-gold-500/25"
            />
            <div
              style={{ "--pop-delay": "0.22s" } as React.CSSProperties}
              className="hero-fade absolute inset-6 animate-spin-rev rounded-full border border-dashed border-gold-400/30 sm:inset-7"
            />
            <div
              style={{ "--pop-delay": "0.34s" } as React.CSSProperties}
              className="hero-fade absolute inset-12 animate-spin-slow rounded-full border border-mint-400/20 sm:inset-14"
            />
            <div className="absolute inset-16 animate-pulse-dot rounded-full bg-gold-500/20 blur-3xl" />

            {/* logo, pops in then floats */}
            <div
              style={{
                transformStyle: "preserve-3d",
                "--pop-from": "0.2",
                "--pop-rot": "-30deg",
                "--pop-dur": "0.8s",
                "--pop-delay": "0.15s",
              } as React.CSSProperties}
              className="hero-pop relative h-[62%] w-[62%]"
            >
              <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                style={{ transform: "translateZ(60px)" }}
                className="relative h-full w-full"
              >
                <Image
                  src="/logo.png"
                  alt="XYZ Crypto"
                  fill
                  priority
                  className="rounded-full object-cover shadow-gold ring-2 ring-gold-500/40"
                  sizes="(max-width: 640px) 70vw, (max-width: 1024px) 45vw, 400px"
                />
              </motion.div>
            </div>

            {/* orbiting badges (WEB3 + more), continuous rotation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="absolute inset-0"
              style={{ animation: "badge-orbit 22s linear infinite", transform: "translateZ(40px)" }}
            >
              {orbitBadges.map((b, i) => {
                // evenly distribute around the ring (start at top, go clockwise)
                const angle = (-90 + i * (360 / orbitBadges.length)) * (Math.PI / 180);
                const r = 50; // % radius
                const left = 50 + r * Math.cos(angle);
                const top = 50 + r * Math.sin(angle);
                return (
                  <div
                    key={b.label}
                    className="absolute"
                    style={{ left: `${left}%`, top: `${top}%`, transform: "translate(-50%,-50%)" }}
                  >
                    {/* counter-rotate to keep text upright + gentle bob */}
                    <div style={{ animation: "badge-orbit 22s linear infinite reverse" }}>
                      <motion.span
                        animate={{ scale: [1, 1.08, 1] }}
                        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
                        className={`block rounded-full border bg-ink-900/85 px-2.5 py-1 mono text-[9px] font-semibold tracking-widest backdrop-blur-md sm:text-[10px] ${toneClass[b.tone]}`}
                      >
                        {b.label}
                      </motion.span>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </motion.div>
        </div>
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
