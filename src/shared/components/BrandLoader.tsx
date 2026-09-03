"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/useClientFlag";

/**
 * Branded route-transition loader: the XYZ Crypto logo on a soft mesh backdrop,
 * ringed by orbiting/pulsing gold rings. Shown during page redirects/loads (via
 * the route loading.tsx → RouteSkeleton). Honors prefers-reduced-motion.
 */
export function BrandLoader({ label = "Loading" }: { label?: string }) {
  const reduced = useReducedMotionSafe();
  const spin = (duration: number, reverse = false) =>
    reduced ? {} : { animate: { rotate: reverse ? -360 : 360 }, transition: { duration, ease: "linear", repeat: Infinity } };

  return (
    <div className="relative flex min-h-[60vh] flex-col items-center justify-center">
      <div className="relative flex aspect-square w-44 items-center justify-center sm:w-52">
        {/* orbiting rings */}
        <motion.span
          {...spin(8)}
          className="absolute inset-0 rounded-full border border-gold-500/30 border-t-gold-400/80"
        />
        <motion.span
          {...spin(6, true)}
          className="absolute inset-4 rounded-full border border-dashed border-mint-400/30"
        />
        <motion.span
          {...spin(10)}
          className="absolute inset-8 rounded-full border border-gold-400/20"
        />
        {/* glow */}
        <span className="absolute inset-10 rounded-full bg-gold-500/20 blur-2xl" />
        {/* logo */}
        <motion.span
          initial={reduced ? false : { scale: 0.9, opacity: 0.85 }}
          animate={reduced ? {} : { scale: [0.92, 1, 0.92], opacity: [0.9, 1, 0.9] }}
          transition={reduced ? undefined : { duration: 2.2, ease: "easeInOut", repeat: Infinity }}
          className="relative h-[50%] w-[50%]"
        >
          <Image
            src="/logo.png"
            alt="XYZ Crypto"
            fill
            sizes="120px"
            className="object-contain drop-shadow-[0_0_18px_rgba(212,169,66,0.55)]"
          />
        </motion.span>
      </div>
      <p className="mono mt-6 text-[11px] uppercase tracking-[0.22em] text-zinc-500">
        {label}
        <span className="ml-0.5 inline-flex">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              animate={reduced ? {} : { opacity: [0.2, 1, 0.2] }}
              transition={reduced ? undefined : { duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            >
              .
            </motion.span>
          ))}
        </span>
      </p>
    </div>
  );
}
