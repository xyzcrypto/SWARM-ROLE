"use client";

import dynamic from "next/dynamic";
import { useWebglGate } from "./orbital/useWebglGate";

// Same-size placeholder - avoids layout shift while the (deferred) JS loads.
// Below-the-fold; never blocks first paint/hydration.
function Placeholder() {
  return (
    <div className="mx-auto aspect-square w-full max-w-[20rem] animate-pulse rounded-full bg-white/[0.02] sm:max-w-md lg:max-w-xl" />
  );
}

// The branded CSS orbital - the reliable, theme-correct (light + dark),
// reduced-motion-safe centerpiece. It's the FALLBACK for the WebGL scene.
const CssOrbital = dynamic(() => import("./OrbitalEcosystem").then((m) => m.OrbitalEcosystem), {
  ssr: false,
  loading: Placeholder,
});

// The cinematic WebGL scene (three.js / R3F). Heavier, so it's only fetched when
// the gate actually chooses it (dark theme + motion allowed + WebGL available).
const WebglOrbital = dynamic(() => import("./orbital/OrbitalScene"), {
  ssr: false,
  loading: Placeholder,
});

// The centerpiece: cinematic WebGL cosmos on capable dark sessions, else the CSS
// orbital. Gate logic lives in useWebglGate (shared with OrbitalBackdrop).
export function OrbitalLazy() {
  return useWebglGate() ? <WebglOrbital /> : <CssOrbital />;
}
