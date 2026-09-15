"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { mulberry32 } from "@shared/utils/rng";
import { useMediaQuery } from "@/lib/useClientFlag";

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

// Orbiting "planets": each rides a ring (dur matches that ring's spin). A couple
// share a ring at an offset start (negative delay) for a fuller solar system.
const ORBITERS = [
  { inset: "0", dur: 13, dir: "normal", size: "h-2.5 w-2.5", dot: "bg-gold-200", glow: "rgba(226,167,47,0.75)", delay: 0 },
  { inset: "0", dur: 13, dir: "normal", size: "h-1.5 w-1.5", dot: "bg-gold-400 dark:bg-white", glow: "rgba(226,167,47,0.7)", delay: -6 },
  { inset: "6%", dur: 22, dir: "normal", size: "h-2 w-2", dot: "bg-sky-200", glow: "rgba(125,211,252,0.6)", delay: 0 },
  { inset: "12%", dur: 18, dir: "reverse", size: "h-2 w-2", dot: "bg-mint-200", glow: "rgba(34,214,146,0.65)", delay: 0 },
  { inset: "24%", dur: 10, dir: "normal", size: "h-2 w-2", dot: "bg-violet-200", glow: "rgba(167,139,250,0.65)", delay: 0 },
  { inset: "24%", dur: 10, dir: "normal", size: "h-1.5 w-1.5", dot: "bg-gold-200", glow: "rgba(226,167,47,0.55)", delay: -5 },
] as const;

export function OrbitalEcosystem() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false); // in-view (gates particle paint cost)

  // Activate the particle field once the section is on/near screen. The rings,
  // aurora and logo glow animate from mount regardless - this is the homepage
  // centerpiece and is intentionally always alive on every device (a deliberate
  // product choice; the motion is slow, GPU-cheap transforms).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
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

  // Particle field. Fewer on phones - each particle is an animated paint layer.
  // Derived rather than set from an effect, and seeded rather than random: the
  // field is identical every time it's computed, so there's no hydration
  // mismatch to avoid in the first place (and the markup can't reshuffle on an
  // unrelated re-render). It's only ever rendered once `active` is true, which
  // is false during SSR and until the IntersectionObserver fires.
  const isNarrow = useMediaQuery("(max-width: 768px)");
  const particles = useMemo(() => {
    const rand = mulberry32(0x0b17a10c);
    return Array.from({ length: isNarrow ? 8 : 22 }, () => ({
      x: rand() * 100,
      y: rand() * 100,
      s: 1 + rand() * 2,
      d: 14 + rand() * 14,
      delay: rand() * 8,
    }));
  }, [isNarrow]);

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
        // Real 3D tilt: rotate the whole orbital plane under the parent
        // perspective (not just a flat slide) so it reads as a dimensional disc.
        orbit.style.transform = `rotateY(${dx * 15}deg) rotateX(${-dy * 15}deg) translate3d(${dx * 14}px, ${dy * 14}px, 0)`;
      });
    };
    const reset = () => { orbit.style.transform = "rotateY(0deg) rotateX(0deg) translate3d(0,0,0)"; };
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
            // `motion-decor` marks an always-running decorative loop so the
            // lite motion tier can drop it (globals.css). The animation is an
            // inline style here because its duration and delay come from the
            // loop index, so a class is the only handle a stylesheet gets.
            className="motion-decor absolute rounded-full bg-gold-300/40"
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
          className="orbital-aurora absolute inset-[16%] rounded-full animate-spin [animation-duration:12s]"
          style={{
            background:
              "conic-gradient(from 0deg, rgba(226,167,47,0) 0deg, rgba(226,167,47,0.24) 90deg, rgba(34,214,146,0.2) 200deg, rgba(226,167,47,0) 360deg)",
            filter: "blur(24px)",
          }}
        />
        {/* rotating rings at different speeds (GPU transform) - always live */}
        <div className="absolute inset-0 rounded-full border border-gold-500/45 animate-spin [animation-duration:13s]" />
        <div className="absolute inset-[6%] rounded-full border border-white/10 animate-spin [animation-duration:22s]" />
        <div className="absolute inset-[12%] rounded-full border border-dashed border-mint-400/45 animate-spin [animation-duration:18s] [animation-direction:reverse]" />
        <div className="absolute inset-[24%] rounded-full border border-gold-400/40 animate-spin [animation-duration:10s]" />
        <div className="absolute inset-[34%] rounded-full bg-gold-500/12 blur-2xl" />

        {/* orbiting "planets" with a short comet trail - the spin speeds match
            the rings above so each planet sits on a ring and orbits. */}
        {ORBITERS.map((o, i) => (
          <div key={i} className="absolute animate-spin" style={{ inset: o.inset, animationDuration: `${o.dur}s`, animationDirection: o.dir, animationDelay: `${o.delay}s` }}>
            {/* trail (two fading dots behind the planet) */}
            <span className={`absolute top-0 h-1 w-1 -translate-y-[1px] rounded-full ${o.dot}`} style={{ left: "calc(50% - 8px)", opacity: 0.45 }} />
            <span className={`absolute top-0 h-[3px] w-[3px] -translate-y-[1px] rounded-full ${o.dot}`} style={{ left: "calc(50% - 14px)", opacity: 0.22 }} />
            <span className={`absolute left-1/2 top-0 -translate-x-1/2 rounded-full ${o.size} ${o.dot}`} style={{ boxShadow: `0 0 12px 2px ${o.glow}` }} />
          </div>
        ))}

        {/* center logo with layered halo */}
        <div className="absolute left-1/2 top-1/2 h-[28%] w-[28%] -translate-x-1/2 -translate-y-1/2">
          <div className="absolute -inset-[35%] rounded-full bg-gold-500/20 blur-2xl" />
          <div className="motion-decor absolute inset-0 rounded-full bg-gold-500/40 blur-xl [animation:ping-soft_3.4s_ease-in-out_infinite]" />
          {/* No ring and no rounded clip: the coin has its own gold rim, and the
              clip was shaving it. The glow follows the alpha via drop-shadow. */}
          <Image
            src="/logo.png"
            alt="XYZ Crypto"
            fill
            sizes="160px"
            className="relative object-contain drop-shadow-[0_0_22px_rgba(212,169,66,0.5)]"
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
            <div className="motion-decor" style={{ animation: `floatY ${5 + (i % 4)}s ease-in-out ${i * 0.3}s infinite` }}>
              <span
                className={`flex items-center gap-1.5 rounded-full border border-white/10 bg-ink-900/85 px-2.5 py-1.5 text-[10px] font-semibold tracking-wide ring-1 backdrop-blur-md transition-all duration-300 group-hover:scale-110 group-active:scale-110 sm:text-[11px] ${toneRing[n.tone]}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                {n.label}
              </span>
              {/* tooltip */}
              {/* `group-active:` so a finger gets the description too. Without it
                  the node's `desc` was readable with a mouse and by a screen
                  reader (it is in the `aria-label`), and invisible to everyone
                  else - the one audience that cannot ask for it another way. */}
              <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-40 -translate-x-1/2 rounded-lg border border-white/10 bg-ink-900/95 px-3 py-2 text-center text-[11px] leading-snug text-zinc-300 opacity-0 shadow-elevate backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100 group-active:opacity-100">
                {n.desc}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
