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
    const hasWebgl = webglAvailable();
    const decide = () => {
      const dark = document.documentElement.classList.contains("dark");
      setWebgl(dark && !reduce.matches && hasWebgl);
    };
    decide();
    reduce.addEventListener("change", decide);
    const mo = new MutationObserver(decide);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      reduce.removeEventListener("change", decide);
      mo.disconnect();
    };
  }, []);
  return webgl;
}
