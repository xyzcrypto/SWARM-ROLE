"use client";

import { useEffect, useState } from "react";

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

// Single source of truth for "should the cinematic WebGL orbital run?" - shared by
// the orbital itself (OrbitalLazy) and the section backdrop (OrbitalBackdrop) so
// they never disagree. WebGL runs on a capable DARK-theme session with motion
// allowed; light theme + reduced-motion + no-WebGL fall back to the CSS cosmos.
// Re-evaluates on theme toggle + reduced-motion change. Starts false so the CSS
// centerpiece renders first, then upgrades after the client check (no CLS).
export function useWebglGate(): boolean {
  const [webgl, setWebgl] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Desktop-only: the cinematic scene is composed for the large square canvas.
    // On phones/tablets the same world reads cramped + the stars oversized, so
    // those get the polished CSS orbital (Saturn/Moon/starfield) instead -
    // cleaner AND lighter.
    const desktop = window.matchMedia("(min-width: 1024px)");
    const hasWebgl = webglAvailable();
    const decide = () => {
      const dark = document.documentElement.classList.contains("dark");
      setWebgl(dark && !reduce.matches && hasWebgl && desktop.matches);
    };
    decide();
    reduce.addEventListener("change", decide);
    desktop.addEventListener("change", decide);
    const mo = new MutationObserver(decide);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      reduce.removeEventListener("change", decide);
      desktop.removeEventListener("change", decide);
      mo.disconnect();
    };
  }, []);
  return webgl;
}
