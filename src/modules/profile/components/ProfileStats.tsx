"use client";

import { useEffect, useState } from "react";
import { FileText, MessageSquare, Heart } from "lucide-react";
import { useReducedMotionSafe } from "@/lib/useClientFlag";
import { Reveal } from "@/components/Reveal";
import { TiltCard } from "@/components/TiltCard";
import { cn } from "@/lib/utils";

const STATS = [
  { key: "posts", label: "Posts", Icon: FileText, icon: "text-gold-400/80", value: "text-gold-gradient" },
  { key: "comments", label: "Comments", Icon: MessageSquare, icon: "text-mint-400/80", value: "text-mint-gradient" },
  { key: "likes", label: "Likes given", Icon: Heart, icon: "text-violet-400/80", value: "text-violet-200" },
] as const;

// Count a number up from 0 → target with an ease-out curve. Static (final value
// straight away) when the visitor prefers reduced motion.
//
// The initial state is unconditionally 0, never `animate ? 0 : target`. The
// server always renders 0 (it cannot know the visitor's motion preference), so
// seeding this from `animate` made the first CLIENT render disagree with the
// server HTML for anyone with reduced motion on - a text mismatch, which React
// treats as a hard hydration failure (#418) and recovers from by throwing away
// the server markup for the whole subtree. The reduced-motion path reaches the
// target in the effect below instead, one frame later.
function useCountUp(target: number, animate: boolean, ms = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!animate) { setN(target); return; }
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, animate, ms]);
  return n;
}

function StatCard({ label, value, Icon, iconClass, valueClass, animate, delay, premium }: {
  label: string; value: number; Icon: typeof FileText; iconClass: string; valueClass: string; animate: boolean; delay: number; premium?: boolean;
}) {
  const shown = useCountUp(value, animate);
  return (
    <Reveal variant="pop" delay={delay}>
      <TiltCard max={8}>
        <div
          className={cn(
            "surface surface-hover lift group relative h-full overflow-hidden rounded-2xl p-4 text-center sm:p-6",
            premium && "ring-1 ring-gold-500/25"
          )}
        >
          <div
            className={cn(
              "glow-orb -right-8 -top-8 h-20 w-20 opacity-0 transition-opacity duration-500 group-hover:opacity-100",
              premium ? "bg-gold-500/20" : "bg-gold-500/10"
            )}
          />
          <Icon className={cn("relative mx-auto h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110 group-active:-translate-y-0.5 group-active:scale-110", iconClass)} />
          <p className={cn("relative mono mt-2 text-2xl font-semibold tabular-nums sm:text-3xl", valueClass)}>{shown.toLocaleString("en-US")}</p>
          <p className="relative mt-1 text-xs text-zinc-500">{label}</p>
        </div>
      </TiltCard>
    </Reveal>
  );
}

// Interactive profile stat row: numbers animate up on load and cards lift on hover.
// `premium` adds a quiet gold ring + stronger glow-on-hover to all three cards,
// matching the rest of the profile's premium treatment.
export function ProfileStats({ posts, comments, likes, premium }: { posts: number; comments: number; likes: number; premium?: boolean }) {
  // Deliberately not framer-motion's `useReducedMotion()` - see the note on
  // useReducedMotionSafe for why that one cannot be rendered from.
  const reduce = useReducedMotionSafe();
  const values: Record<string, number> = { posts, comments, likes };
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-5">
      {STATS.map((s, i) => (
        <StatCard
          key={s.key}
          label={s.label}
          value={values[s.key]}
          Icon={s.Icon}
          iconClass={s.icon}
          valueClass={s.value}
          animate={!reduce}
          delay={i}
          premium={premium}
        />
      ))}
    </div>
  );
}
