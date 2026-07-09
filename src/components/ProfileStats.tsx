"use client";

import { useEffect, useState } from "react";
import { FileText, MessageSquare, Heart } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/Reveal";
import { cn } from "@/lib/utils";

const STATS = [
  { key: "posts", label: "Posts", Icon: FileText, icon: "text-gold-400/80", value: "text-gold-gradient" },
  { key: "comments", label: "Comments", Icon: MessageSquare, icon: "text-mint-400/80", value: "text-mint-gradient" },
  { key: "likes", label: "Likes given", Icon: Heart, icon: "text-violet-400/80", value: "text-violet-200" },
] as const;

// Count a number up from 0 → target with an ease-out curve. Static (final value
// straight away) when the visitor prefers reduced motion.
function useCountUp(target: number, animate: boolean, ms = 900) {
  const [n, setN] = useState(animate ? 0 : target);
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

function StatCard({ label, value, Icon, iconClass, valueClass, animate, delay }: {
  label: string; value: number; Icon: typeof FileText; iconClass: string; valueClass: string; animate: boolean; delay: number;
}) {
  const shown = useCountUp(value, animate);
  return (
    <Reveal variant="pop" delay={delay}>
      <div className="surface surface-hover lift group h-full rounded-2xl p-4 text-center sm:p-6">
        <Icon className={cn("mx-auto h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110", iconClass)} />
        <p className={cn("mono mt-2 text-2xl font-semibold tabular-nums sm:text-3xl", valueClass)}>{shown.toLocaleString()}</p>
        <p className="mt-1 text-xs text-zinc-500">{label}</p>
      </div>
    </Reveal>
  );
}

// Interactive profile stat row: numbers animate up on load and cards lift on hover.
export function ProfileStats({ posts, comments, likes }: { posts: number; comments: number; likes: number }) {
  const reduce = useReducedMotion();
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
        />
      ))}
    </div>
  );
}
