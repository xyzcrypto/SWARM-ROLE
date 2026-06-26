"use client";

import dynamic from "next/dynamic";

// Same-size placeholder — avoids layout shift while the (deferred) JS loads.
// Below-the-fold; never blocks first paint/hydration.
function Placeholder() {
  return (
    <div className="mx-auto aspect-square w-full max-w-[20rem] animate-pulse rounded-full bg-white/[0.02] sm:max-w-md lg:max-w-xl" />
  );
}

// The branded CSS orbital — the signature centerpiece on every device. It's
// lighter, theme-correct (light + dark) and animates reliably on desktop, so we
// no longer gate a heavier WebGL variant behind device checks (three.js is no
// longer fetched on the homepage). The R3F scene (OrbitalScene3D) stays in the
// repo for a future, properly art-directed pass.
const CssOrbital = dynamic(() => import("./OrbitalEcosystem").then((m) => m.OrbitalEcosystem), {
  ssr: false,
  loading: Placeholder,
});

export function OrbitalLazy() {
  return <CssOrbital />;
}
