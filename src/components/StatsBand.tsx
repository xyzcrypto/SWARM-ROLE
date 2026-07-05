"use client";

import { useRef, useEffect } from "react";
import { useInView, useMotionValue, useTransform, animate, motion } from "framer-motion";

const stats = [
  { raw: 10,  suffix: "K+", label: "Community Members", icon: "👥" },
  { raw: 6,   suffix: "+",  label: "Products Building",  icon: "🔧" },
  { raw: 3,   suffix: "",   label: "Ecosystem Pillars",  icon: "🏛️" },
  { raw: 100, suffix: "%",  label: "Community Owned",    icon: "💎" },
];

function Counter({ raw, suffix }: { raw: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));
  const inView = useInView(ref, { once: true, margin: "-60px" });

  useEffect(() => {
    if (!inView) return;
    const controls = animate(count, raw, { duration: 2, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [inView, count, raw]);

  return (
    <span ref={ref} className="stat-num">
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  );
}

export function StatsBand() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div
      ref={ref}
      className="relative overflow-hidden border-y border-white/[0.05] bg-ink-950"
    >
      {/* Scan line */}
      <div className="pointer-events-none absolute inset-0 animate-scan-line bg-[linear-gradient(90deg,transparent_0%,rgba(233,160,32,0.06)_50%,transparent_100%)] bg-[length:200%_100%]" />

      {/* Top gold line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/20 to-transparent" />

      <div className="mx-auto grid max-w-7xl grid-cols-2 px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className={`stat-cell group flex flex-col items-center justify-center py-10 px-4 text-center ${
              i > 0 ? "border-l border-white/[0.05]" : ""
            }`}
          >
            <div className="text-3xl font-bold text-gold-gradient sm:text-[2.2rem] transition-all duration-300 group-hover:scale-105">
              <Counter raw={s.raw} suffix={s.suffix} />
            </div>
            <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600 transition-colors duration-300 group-hover:text-zinc-500">
              {s.label}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Bottom gold line */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-400/10 to-transparent" />
    </div>
  );
}
