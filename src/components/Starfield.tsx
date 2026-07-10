import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

// Deterministic star positions (seeded, computed once at module load) so SSR and
// the client render identically - no hydration mismatch, no layout shift, no
// per-render Math.random. Gives the orbital section a deep-space backdrop so the
// whole thing reads like a little solar system.
const STARS = Array.from({ length: 180 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.6789;
  const c = Math.sin(i * 45.164) * 91537.4231;
  const fa = Math.abs(a - Math.floor(a));
  const fb = Math.abs(b - Math.floor(b));
  const fc = Math.abs(c - Math.floor(c));
  const bright = i % 10 === 0; // brighter "hero" stars with a glow
  const drift = !bright && i % 4 === 1; // ~1/4 of the faint stars slowly travel
  return {
    x: fa * 100,
    y: fb * 100,
    s: bright ? 2.4 + ((i * 3) % 2) : 1 + ((i * 7) % 3) * 0.5, // px
    o: bright ? 0.9 : 0.2 + ((i * 13) % 5) * 0.11,
    d: 3 + ((i * 5) % 5), // 3 - 7s twinkle
    delay: (i % 11) * 0.35,
    gold: i % 6 === 0, // a few warm stars for the brand tint
    bright,
    drift,
    // slow drift vector + long duration (only used when `drift`)
    dx: `${(fc - 0.5) * 34}px`,
    dy: `${-(10 + fc * 22)}px`,
    driftDur: 26 + (i % 7) * 4, // 26 - 50s
  };
});

// Diagonal "shooting stars" streaking in from different corners/angles so they
// feel like real meteors, not one repeating line. Long cycles = occasional.
const SHOOTERS = [
  { top: "12%", left: "6%", dur: "6.5s", delay: "1s", rot: "22deg", dx: "300px", dy: "120px" },
  { top: "60%", left: "38%", dur: "9s", delay: "4.5s", rot: "18deg", dx: "260px", dy: "85px" },
  { top: "22%", left: "70%", dur: "7.5s", delay: "2.6s", rot: "150deg", dx: "-280px", dy: "150px" },
  { top: "78%", left: "84%", dur: "11s", delay: "7s", rot: "205deg", dx: "-240px", dy: "-110px" },
  { top: "40%", left: "20%", dur: "8s", delay: "9.5s", rot: "30deg", dx: "320px", dy: "180px" },
];

// Faint coloured nebula haze for depth behind the stars (very low opacity so it
// reads as atmosphere, not colour wash). Each drifts/breathes on its own cycle.
const NEBULAE = [
  { left: "-8%", top: "8%", size: "46%", color: "rgba(226,167,47,0.05)", dur: "26s", delay: "0s" },
  { left: "62%", top: "48%", size: "50%", color: "rgba(34,214,146,0.045)", dur: "32s", delay: "-8s" },
  { left: "30%", top: "-6%", size: "40%", color: "rgba(167,139,250,0.04)", dur: "38s", delay: "-16s" },
];

// Full-bleed starfield layer. pointer-events-none; dark-only (hidden on the
// light theme, where light stars would vanish on white); twinkle + drift +
// shooters + planet all stop under prefers-reduced-motion.
export function Starfield({ className, planet = true }: { className?: string; planet?: boolean }) {
  return (
    <div aria-hidden className={cn("starfield pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {NEBULAE.map((n, i) => (
        <div
          key={`neb${i}`}
          className="starfield-neb absolute rounded-full"
          style={{
            left: n.left,
            top: n.top,
            width: n.size,
            aspectRatio: "1",
            background: `radial-gradient(circle, ${n.color}, transparent 70%)`,
            filter: "blur(40px)",
            animation: `neb-float ${n.dur} ease-in-out ${n.delay} infinite`,
          }}
        />
      ))}

      {/* distant planet - the signature "unique cosmos" touch (dark-only, faint,
          tucked top-left so it never collides with the logo/medallion). */}
      {planet && (
        <div
          className="starfield-planet starfield-extra absolute hidden sm:block"
          style={{ left: "76%", top: "12%", width: 120, height: 120, animation: "planet-bob 14s ease-in-out infinite" }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 35% 30%, rgba(244,212,136,0.28), rgba(226,167,47,0.12) 45%, rgba(10,10,15,0) 72%)",
              boxShadow: "0 0 40px 6px rgba(226,167,47,0.10)",
            }}
          />
          {/* faint tilted ring */}
          <div
            className="absolute left-1/2 top-1/2 rounded-[100%] border border-gold-300/15"
            style={{ width: 168, height: 46, transform: "translate(-50%,-50%) rotate(-24deg)" }}
          />
        </div>
      )}

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
            // CSS custom properties consumed by the twinkle / drift keyframes
            ...({ "--o": st.o, "--dx": st.dx, "--dy": st.dy } as React.CSSProperties),
            animation: st.drift
              ? `star-drift ${st.driftDur}s ease-in-out ${st.delay}s infinite`
              : `star-twinkle ${st.d}s ease-in-out ${st.delay}s infinite`,
          }}
        />
      ))}

      {SHOOTERS.map((sh, i) => (
        <span
          key={`sh${i}`}
          className="star-shooter"
          style={{
            top: sh.top,
            left: sh.left,
            ...({ "--rot": sh.rot, "--dx": sh.dx, "--dy": sh.dy } as React.CSSProperties),
            animation: `star-shoot ${sh.dur} ease-in ${sh.delay} infinite`,
          }}
        />
      ))}
    </div>
  );
}
