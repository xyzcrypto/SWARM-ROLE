"use client";

import { motion, useReducedMotion } from "framer-motion";

// App-router templates re-mount on every navigation, so this gives each route a
// quick, professional fade/rise-in transition. Honors prefers-reduced-motion
// (renders with no motion when the user opts out).
export default function Template({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  if (reduced) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
