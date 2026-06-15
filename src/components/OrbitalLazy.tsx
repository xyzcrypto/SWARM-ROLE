"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Same-size placeholder for both variants — avoids layout shift while the
// (deferred) JS loads. Below-the-fold; never blocks first paint/hydration.
function Placeholder() {
  return (
    <div className="mx-auto aspect-square w-full max-w-[20rem] animate-pulse rounded-full bg-white/[0.02] sm:max-w-md lg:max-w-xl" />
  );
}

// The lightweight CSS orbital — always the fallback, and what mobile / low-power
// / reduced-motion / no-WebGL visitors get (they never download three.js).
const CssOrbital = dynamic(() => import("./OrbitalEcosystem").then((m) => m.OrbitalEcosystem), {
  ssr: false,
  loading: Placeholder,
});

// The premium React-Three-Fiber scene — only imported (so three.js only
// downloads) when the device is capable.
const Scene3D = dynamic(() => import("./OrbitalScene3D"), {
  ssr: false,
  loading: Placeholder,
});

function isWebglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

export function OrbitalLazy() {
  // Default to the CSS orbital; upgrade to 3D only after confirming the device
  // can handle it (so the 3D chunk is never fetched on mobile/low-power).
  const [use3D, setUse3D] = useState(false);

  useEffect(() => {
    const mq = (q: string) => window.matchMedia(q).matches;
    const reduced = mq("(prefers-reduced-motion: reduce)");
    const fine = mq("(pointer: fine)");
    const desktop = mq("(min-width: 1024px)");
    const cores = navigator.hardwareConcurrency ?? 8;
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
    const capable = !reduced && fine && desktop && cores >= 4 && mem >= 4 && isWebglAvailable();
    if (capable) setUse3D(true);
  }, []);

  return use3D ? <Scene3D /> : <CssOrbital />;
}
