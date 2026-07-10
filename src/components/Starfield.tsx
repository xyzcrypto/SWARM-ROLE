import { cn } from "@/lib/utils";

// Deterministic star positions (seeded, computed once at module load) so SSR and
// the client render identically - no hydration mismatch, no layout shift, no
// per-render Math.random. Gives the orbital section a deep-space backdrop so the
// whole thing reads like a little solar system.
const STARS = Array.from({ length: 180 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.6789;
  const bright = i % 10 === 0; // brighter "hero" stars with a glow
  return {
    x: Math.abs(a - Math.floor(a)) * 100,
    y: Math.abs(b - Math.floor(b)) * 100,
    s: bright ? 2.4 + ((i * 3) % 2) : 1 + ((i * 7) % 3) * 0.5, // px
    o: bright ? 0.9 : 0.2 + ((i * 13) % 5) * 0.11,
    d: 3 + ((i * 5) % 5), // 3 - 7s twinkle
    delay: (i % 11) * 0.35,
    gold: i % 6 === 0, // a few warm stars for the brand tint
    bright,
  };
});

// Two slow diagonal "shooting stars" (long cycles so they feel occasional).
const SHOOTERS = [
  { top: "14%", left: "8%", dur: "7s", delay: "1.5s" },
  { top: "62%", left: "40%", dur: "9s", delay: "5s" },
];

// Faint coloured nebula haze for depth behind the stars (very low opacity so it
// reads as atmosphere, not colour wash). pointer-events-none.
const NEBULAE = [
  { left: "-8%", top: "8%", size: "46%", color: "rgba(226,167,47,0.05)" },
  { left: "62%", top: "48%", size: "50%", color: "rgba(34,214,146,0.045)" },
  { left: "30%", top: "-6%", size: "40%", color: "rgba(167,139,250,0.04)" },
];

// Full-bleed starfield layer. pointer-events-none; dark-only (hidden on the
// light theme, where light stars would vanish on white); twinkle + shooters stop
// under prefers-reduced-motion.
export function Starfield({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("starfield pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {NEBULAE.map((n, i) => (
        <div
          key={`neb${i}`}
          className="absolute rounded-full"
          style={{ left: n.left, top: n.top, width: n.size, aspectRatio: "1", background: `radial-gradient(circle, ${n.color}, transparent 70%)`, filter: "blur(40px)" }}
        />
      ))}
      {STARS.map((st, i) => (
        <span
          key={i}
          // The extra half only renders on >=md so phones paint ~90 stars, not 180.
          className={cn("absolute rounded-full", st.gold ? "bg-gold-200" : "bg-white", i >= 90 && "starfield-extra")}
          style={{
            left: `${st.x}%`,
            top: `${st.y}%`,
            width: st.s,
            height: st.s,
            opacity: st.o,
            boxShadow: st.bright ? (st.gold ? "0 0 6px 1px rgba(244,212,136,0.7)" : "0 0 6px 1px rgba(255,255,255,0.6)") : undefined,
            // @ts-expect-error CSS custom property consumed by the star-twinkle keyframe
            "--o": st.o,
            animation: `star-twinkle ${st.d}s ease-in-out ${st.delay}s infinite`,
          }}
        />
      ))}
      {SHOOTERS.map((sh, i) => (
        <span
          key={`sh${i}`}
          className="star-shooter"
          style={{ top: sh.top, left: sh.left, animation: `star-shoot ${sh.dur} ease-in ${sh.delay} infinite` }}
        />
      ))}
    </div>
  );
}
