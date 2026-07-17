import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { RobotIcon } from "./RobotIcon";

// Deterministic star positions (seeded, computed once at module load) so SSR and
// the client render identically - no hydration mismatch, no layout shift, no
// per-render Math.random. Gives the orbital section a deep-space backdrop so the
// whole thing reads like a little solar system.
const STARS = Array.from({ length: 110 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.6789;
  const c = Math.sin(i * 45.164) * 91537.4231;
  const fa = Math.abs(a - Math.floor(a));
  const fb = Math.abs(b - Math.floor(b));
  const fc = Math.abs(c - Math.floor(c));
  const bright = i % 7 === 0; // more glowing "hero" stars
  const drift = !bright && i % 6 === 1; // a few slow drifters
  return {
    x: fa * 100,
    y: fb * 100,
    s: bright ? 2.6 + ((i * 3) % 3) : 0.9 + ((i * 7) % 3) * 0.6, // px
    o: bright ? 0.96 : 0.22 + ((i * 13) % 5) * 0.12,
    d: 3 + ((i * 5) % 5), // 3 - 7s twinkle
    delay: (i % 11) * 0.35,
    gold: i % 6 === 0, // a few warm stars for the brand tint
    bright,
    drift,
    // Only bright + drift stars animate; the rest are static dots. Far fewer
    // running animations (esp. on mobile) for the same "full sky" density.
    animated: bright || drift,
    dx: `${(fc - 0.5) * 34}px`,
    dy: `${-(10 + fc * 22)}px`,
    driftDur: 26 + (i % 7) * 4, // 26 - 50s
  };
});

// Diagonal "shooting stars" streaking in from different corners/angles so they
// feel like real meteors, not one repeating line. Long cycles = occasional.
const SHOOTERS = [
  { top: "10%", left: "4%", dur: "4.5s", delay: "0.4s", rot: "24deg", dx: "340px", dy: "150px" },
  { top: "18%", left: "40%", dur: "5.5s", delay: "1.3s", rot: "20deg", dx: "320px", dy: "120px" },
  { top: "12%", left: "62%", dur: "5s", delay: "2.2s", rot: "150deg", dx: "-320px", dy: "170px" },
  { top: "8%", left: "88%", dur: "6s", delay: "3.1s", rot: "160deg", dx: "-300px", dy: "150px" },
  { top: "34%", left: "26%", dur: "4.8s", delay: "3.9s", rot: "28deg", dx: "360px", dy: "190px" },
  { top: "40%", left: "70%", dur: "5.3s", delay: "4.8s", rot: "150deg", dx: "-300px", dy: "160px" },
  { top: "52%", left: "12%", dur: "4.6s", delay: "5.6s", rot: "26deg", dx: "360px", dy: "200px" },
  { top: "58%", left: "52%", dur: "6s", delay: "6.5s", rot: "18deg", dx: "300px", dy: "100px" },
  { top: "26%", left: "50%", dur: "5s", delay: "7.3s", rot: "22deg", dx: "330px", dy: "140px" },
  { top: "70%", left: "84%", dur: "5.4s", delay: "8.2s", rot: "205deg", dx: "-260px", dy: "-120px" },
  { top: "46%", left: "36%", dur: "5.2s", delay: "9s", rot: "32deg", dx: "330px", dy: "200px" },
  { top: "64%", left: "66%", dur: "5.6s", delay: "10s", rot: "150deg", dx: "-320px", dy: "150px" },
];

// Faint coloured nebula haze for depth behind the stars (very low opacity so it
// reads as atmosphere, not colour wash). Each drifts/breathes on its own cycle.
const NEBULAE = [
  { left: "-8%", top: "8%", size: "46%", color: "rgba(226,167,47,0.05)", dur: "26s", delay: "0s" },
  { left: "62%", top: "48%", size: "50%", color: "rgba(34,214,146,0.045)", dur: "32s", delay: "-8s" },
  { left: "30%", top: "-6%", size: "40%", color: "rgba(167,139,250,0.04)", dur: "38s", delay: "-16s" },
];

// Full-bleed starfield layer. pointer-events-none. Works in BOTH themes (dark =
// deep space, light = warm "day sky" via the globals light remap). `bodies`
// gates Saturn + Moon (off in the hero, where the medallion owns the right
// side). `light` halves the shooting-star count - this component is mounted
// twice on the homepage (Hero + the orbital section's own backdrop), and on
// desktop both mounts render their full, non-reduced star/shooter set (the
// mobile media query only trims `.starfield-extra`/`.star-shooter-extra`) -
// two full copies stacked back-to-back is real, avoidable paint/compositing
// cost with no real visual benefit (they read as one continuous backdrop,
// not two distinct scenes), so the second mount uses the lighter set.
export function Starfield({ className, bodies = true, light = false }: { className?: string; bodies?: boolean; light?: boolean }) {
  const shooters = light ? SHOOTERS.filter((_, i) => i % 2 === 0) : SHOOTERS;
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

      {bodies && (
        <>
          {/* Realistic Saturn (upper-right): banded gas globe + shaded terminator
              + Cassini-gap ring crossing behind the top / in front of the bottom.
              clamp() keeps it in proportion from phone to desktop. */}
          <div
            className="saturn absolute"
            style={{ animation: "planet-bob 14s ease-in-out infinite" }}
          >
            <div className="saturn-ring saturn-ring-back" />
            <div className="saturn-body" />
            <div className="saturn-ring saturn-ring-front" />
          </div>

          {/* Realistic Moon (left side): cratered, shaded sphere with a soft halo. */}
          <div
            className="moon absolute"
            style={{ animation: "moon-bob 12s ease-in-out infinite" }}
          >
            <div className="moon-body" />
            {/* XYZ robot mascot sitting in the crescent's curve */}
            <div className="moon-robot">
              <RobotIcon />
            </div>
          </div>
        </>
      )}

      {STARS.map((st, i) => (
        <span
          key={i}
          // star-w / star-g let the light theme recolour them (warm amber) so
          // they don't vanish on white; the extra half only paints on >=md.
          className={cn(
            "absolute rounded-full",
            st.gold ? "bg-gold-200 star-g" : "bg-white star-w",
            i >= 42 && "starfield-extra"
          )}
          style={{
            left: `${st.x}%`,
            top: `${st.y}%`,
            width: st.s,
            height: st.s,
            opacity: st.o,
            boxShadow: st.bright
              ? st.gold
                ? "0 0 7px 1.5px rgba(244,212,136,0.85)"
                : "0 0 7px 1.5px rgba(255,255,255,0.75)"
              : undefined,
            // CSS custom properties consumed by the twinkle / drift keyframes
            ...({ "--o": st.o, "--dx": st.dx, "--dy": st.dy } as CSSProperties),
            // Only bright/drift stars animate; faint stars stay static (perf).
            animation: st.animated
              ? st.drift
                ? `star-drift ${st.driftDur}s ease-in-out ${st.delay}s infinite`
                : `star-twinkle ${st.d}s ease-in-out ${st.delay}s infinite`
              : undefined,
          }}
        />
      ))}

      {shooters.map((sh, i) => (
        <span
          key={`sh${i}`}
          // only ~3 meteors on phones (the extras only paint on >= md)
          className={cn("star-shooter", i >= 3 && "star-shooter-extra")}
          style={{
            top: sh.top,
            left: sh.left,
            ...({ "--rot": sh.rot, "--dx": sh.dx, "--dy": sh.dy } as CSSProperties),
            animation: `star-shoot ${sh.dur} ease-in ${sh.delay} infinite`,
          }}
        />
      ))}
    </div>
  );
}
