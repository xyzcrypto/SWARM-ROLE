import { cn } from "@/lib/utils";

// Deterministic star positions (seeded, computed once at module load) so SSR and
// the client render identically - no hydration mismatch, no layout shift, no
// per-render Math.random. Gives the orbital section a faint "deep space" backdrop
// behind the rings so the whole thing reads like a little solar system.
const STARS = Array.from({ length: 64 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.6789;
  return {
    x: Math.abs(a - Math.floor(a)) * 100,
    y: Math.abs(b - Math.floor(b)) * 100,
    s: 1 + ((i * 7) % 3) * 0.6, // 1 - 2.2px
    o: 0.22 + ((i * 13) % 5) * 0.12, // 0.22 - 0.7
    d: 3 + ((i * 5) % 5), // 3 - 7s twinkle
    delay: (i % 9) * 0.4,
    gold: i % 5 === 0, // a few warm stars for the brand tint
  };
});

// Full-bleed starfield layer. pointer-events-none; dark-only (hidden on the
// light theme via globals, where white stars would vanish on white); the
// twinkle stops under prefers-reduced-motion.
export function Starfield({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("starfield pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {STARS.map((st, i) => (
        <span
          key={i}
          className={cn("absolute rounded-full", st.gold ? "bg-gold-200" : "bg-white")}
          style={{
            left: `${st.x}%`,
            top: `${st.y}%`,
            width: st.s,
            height: st.s,
            opacity: st.o,
            // @ts-expect-error CSS custom property consumed by the star-twinkle keyframe
            "--o": st.o,
            animation: `star-twinkle ${st.d}s ease-in-out ${st.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
