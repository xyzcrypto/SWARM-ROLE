"use client";

import { useEffect, useState } from "react";
import { Starfield } from "./Starfield";
import { useWebglGate } from "./orbital/useWebglGate";

// The section's full-bleed backdrop.
// - Desktop dark  -> WebGL scene draws its own Saturn/Moon, so the CSS backdrop
//   shows only ambient stars (bodies off).
// - Mobile/tablet -> owner wants NO CSS Saturn/Moon (a clean orbital + stars),
//   so bodies stay off there too.
// - Desktop light -> keeps the CSS Saturn/Moon (bodies on) since there's no WebGL.
export function OrbitalBackdrop() {
  const webgl = useWebglGate();
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const apply = () => setDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return <Starfield bodies={!webgl && desktop} />;
}
