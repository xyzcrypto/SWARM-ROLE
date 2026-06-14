"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Node = { label: string; desc: string; href: string; tone: "gold" | "mint" | "violet" };

// Ecosystem nodes placed evenly around the logo. Links point at existing
// sections/routes so clicks navigate without any backend change.
const NODES: Node[] = [
  { label: "Research", desc: "On-chain research & market intelligence", href: "/research", tone: "gold" },
  { label: "Trading", desc: "Pro trading tools & live signals", href: "/#products", tone: "mint" },
  { label: "Airdrops", desc: "Airdrop tracking & eligibility", href: "/#products", tone: "violet" },
  { label: "Perp DEX", desc: "On-chain perpetual futures exchange", href: "/#products", tone: "gold" },
  { label: "AI Tools", desc: "AI-powered market assistants", href: "/#products", tone: "mint" },
  { label: "Analytics", desc: "Real-time charts & on-chain data", href: "/#products", tone: "violet" },
  { label: "Premium", desc: "Exclusive premium research", href: "/research", tone: "gold" },
  { label: "Education", desc: "XYZ Web3 Academy & guides", href: "/#ecosystem", tone: "mint" },
  { label: "Community", desc: "Join the XYZ Crypto community", href: "/community", tone: "violet" },
];

const toneRing: Record<Node["tone"], string> = {
  gold: "ring-gold-500/40 text-gold-200 hover:shadow-[0_0_24px_-4px_rgba(226,167,47,0.6)]",
  mint: "ring-mint-500/40 text-mint-200 hover:shadow-[0_0_24px_-4px_rgba(34,214,146,0.55)]",
  violet: "ring-violet-400/40 text-violet-200 hover:shadow-[0_0_24px_-4px_rgba(167,139,250,0.5)]",
};

export function OrbitalEcosystem() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false); // in-view (gates particles + parallax)
  const [particles, setParticles] = useState<{ x: number; y: number; s: number; d: number; delay: number }[]>([]);
  // The signature rings/aurora/logo-glow animate as soon as the component mounts
  // (this is the centerpiece - it must visibly run on desktop, not wait for an
  // in-view trigger). Only `prefers-reduced-motion` turns them off. Read once at
  // mount (client-only component, so window is available - no hydration flash).
  const [reduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  // Activate animations only when in view and motion is allowed (perf + a11y).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    // If it's already on/near screen at mount (common on desktop where the
    // section sits high), activate immediately - don't wait for an intersection
    // change that may never fire. Otherwise observe and activate on scroll-in.
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 1.2 && r.bottom > -window.innerHeight * 0.2) {
      setActive(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setActive(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px", threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Particle field generated client-side (no SSR/hydration mismatch, no CLS).
  // Fewer on phones - each particle is an animated paint layer.
  useEffect(() => {
    if (!active) return;
    const count = window.matchMedia("(max-width: 768px)").matches ? 14 : 34;
    setParticles(
      Array.from({ length: count }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        s: 1 + Math.random() * 2,
        d: 14 + Math.random() * 14,
        delay: Math.random() * 8,
      }))
    );
  }, [active]);

  // Desktop parallax (rAF-throttled, transform-only, pointer:fine only).
  useEffect(() => {
    if (!active) return;
    const wrap = wrapRef.current;
    const orbit = orbitRef.current;
    if (!wrap || !orbit || !window.matchMedia("(pointer: fine)").matches) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = wrap.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        orbit.style.transform = `translate3d(${dx * 18}px, ${dy * 18}px, 0)`;
      });
    };
    const reset = () => { orbit.style.transform = "translate3d(0,0,0)"; };
    wrap.addEventListener("mousemove", onMove, { passive: true });
    wrap.addEventListener("mouseleave", reset);
    return () => {
      wrap.removeEventListener("mousemove", onMove);
      wrap.removeEventListener("mouseleave", reset);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [active]);

  const nodePositions = useMemo(
    () =>
      NODES.map((n, i) => {
        const angle = (-90 + i * (360 / NODES.length)) * (Math.PI / 180);
        const r = 46; // % radius
        return { ...n, left: 50 + r * Math.cos(angle), top: 50 + r * Math.sin(angle) };
      }),
    []
  );

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto aspect-square w-full max-w-[17.5rem] xs:max-w-[20rem] sm:max-w-lg lg:max-w-2xl"
      style={{ perspective: "1000px" }}
    >
      {/* soft particle field */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
        {particles.map((p, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-gold-300/40"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.s,
              height: p.s,
              animation: `drift-a ${p.d}s ease-in-out ${p.delay}s infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* orbital system (parallax target) */}
      <div ref={orbitRef} className="absolute inset-0 transition-transform duration-300 ease-out will-change-transform">
        {/* rotating conic aurora glow (gold -> mint) for depth */}
        <div
          className={`absolute inset-[16%] rounded-full ${!reduced ? "animate-spin [animation-duration:16s]" : ""}`}
          style={{
            background:
              "conic-gradient(from 0deg, rgba(226,167,47,0) 0deg, rgba(226,167,47,0.18) 90deg, rgba(34,214,146,0.16) 200deg, rgba(226,167,47,0) 360deg)",
            filter: "blur(26px)",
          }}
        />
        {/* rotating rings at different speeds (GPU transform) - always live */}
        <div className={`absolute inset-0 rounded-full border border-gold-500/25 ${!reduced ? "animate-spin [animation-duration:18s]" : ""}`} />
        <div className={`absolute inset-[12%] rounded-full border border-dashed border-mint-400/25 ${!reduced ? "animate-spin [animation-duration:24s] [animation-direction:reverse]" : ""}`} />
        <div className={`absolute inset-[24%] rounded-full border border-gold-400/20 ${!reduced ? "animate-spin [animation-duration:14s]" : ""}`} />
        <div className="absolute inset-[34%] rounded-full bg-gold-500/10 blur-2xl" />

        {/* center logo with subtle pulse */}
        <div className="absolute left-1/2 top-1/2 h-[28%] w-[28%] -translate-x-1/2 -translate-y-1/2">
          <div className={`absolute inset-0 rounded-full bg-gold-500/30 blur-xl ${!reduced ? "[animation:ping-soft_3.4s_ease-in-out_infinite]" : ""}`} />
          <Image
            src="/logo.jpg"
            alt="XYZ Crypto"
            fill
            sizes="160px"
            className="relative rounded-full object-cover ring-2 ring-gold-500/50 shadow-gold"
          />
        </div>

        {/* ecosystem nodes */}
        {nodePositions.map((n, i) => (
          <Link
            key={n.label}
            href={n.href}
            aria-label={`${n.label} - ${n.desc}`}
            className="group absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${n.left}%`, top: `${n.top}%` }}
          >
            <div style={!reduced ? { animation: `floatY ${5 + (i % 4)}s ease-in-out ${i * 0.3}s infinite` } : undefined}>
              <span
                className={`flex items-center gap-1.5 rounded-full border border-white/10 bg-ink-900/85 px-2.5 py-1.5 text-[10px] font-semibold tracking-wide ring-1 backdrop-blur-md transition-all duration-300 group-hover:scale-110 sm:text-[11px] ${toneRing[n.tone]}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                {n.label}
              </span>
              {/* tooltip */}
              <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-40 -translate-x-1/2 rounded-lg border border-white/10 bg-ink-900/95 px-3 py-2 text-center text-[11px] leading-snug text-zinc-300 opacity-0 shadow-elevate backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100">
                {n.desc}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
