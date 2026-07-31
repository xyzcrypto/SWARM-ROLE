"use client";

import dynamic from "next/dynamic";

// Defer Lenis (smooth scroll) out of the shared bundle. It already no-ops on
// touch + reduced-motion, so loading its JS lazily costs nothing perceptible.
const Smooth = dynamic(() => import("./SmoothScroll").then((m) => m.SmoothScroll), { ssr: false });

export function SmoothScrollMount() {
  return <Smooth />;
}
