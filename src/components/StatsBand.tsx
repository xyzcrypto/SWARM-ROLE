"use client";

import { useRef, useEffect } from "react";
import { useInView, useMotionValue, useTransform, animate, motion } from "framer-motion";

const stats = [
  { raw: 10,   suffix: "K+",  label: "Community Members",   prefix: "" },
  { raw: 6,    suffix: "+",   label: "Products Building",    prefix: "" },
  { raw: 3,    suffix: "",    label: "Ecosystem Pillars",    prefix: "" },
  { raw: 100,  suffix: "%",   label: "Community Owned",      prefix: "" },
];

function Counter({ raw, suffix, prefix }: { raw: number; suffix: string; prefix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));
  const inView = useInView(ref, { once: true, margin: "-60px" });

  useEffect(() => {
    if (!inView) return;
    const controls = animate(count, raw, { duration: 1.8, ease: "easeOut" });
    return () => controls.stop();
  }, [inView, count, raw]);

  return (
    <span ref={ref} className="stat-num">
      {prefix}
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
      {/* Moving gold spotlight scan line */}
      <div className="pointer-events-none absolute inset-0 animate-scan-line bg-[linear-gradient(90deg,transparent_0%,rgba(233,160,32,0.06)_50%,transparent_100%)] bg-[length:200%_100%]" />

      <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-white/[0.05] px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center justify-center py-10 px-4 text-center"
          >
            <div className="text-3xl font-bold text-gold-gradient sm:text-4xl">
              <Counter raw={s.raw} suffix={s.suffix} prefix={s.prefix} />
            </div>
            <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600">
              {s.label}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
