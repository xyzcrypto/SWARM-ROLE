"use client";

import { Starfield } from "./Starfield";

// The orbital section backdrop: just the ambient starfield (stars + shooting
// stars + nebulae). No Saturn/Moon/robot bodies (removed per owner).
export function OrbitalBackdrop() {
  return <Starfield bodies={false} />;
}
