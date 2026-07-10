"use client";

import { Starfield } from "./Starfield";
import { useWebglGate } from "./orbital/useWebglGate";

// The section's full-bleed backdrop. When the WebGL scene is active it draws its
// OWN cosmos (stars + Saturn + Moon), so the CSS backdrop drops its celestial
// bodies to avoid double planets - it keeps only faint ambient stars filling the
// margins around the 3D canvas. In the CSS-fallback path it renders the full
// starfield (stars + Saturn + Moon), exactly as before.
export function OrbitalBackdrop() {
  const webgl = useWebglGate();
  return <Starfield bodies={!webgl} />;
}
