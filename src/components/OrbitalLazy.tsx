"use client";

import dynamic from "next/dynamic";

// Same-size placeholder - avoids layout shift while the (deferred) JS loads.
// Below-the-fold; never blocks first paint/hydration.
function Placeholder() {
  return (
    <div className="mx-auto aspect-square w-full max-w-[20rem] animate-pulse rounded-full bg-white/[0.02] sm:max-w-md lg:max-w-xl" />
  );
}

/**
 * The homepage centrepiece: the branded CSS orbital, code-split and mounted on
 * the client so it never blocks first paint.
 *
 * ## There used to be a second option here
 *
 * This file chose between a three.js / React-Three-Fiber cosmos and the CSS
 * orbital, behind `useWebglGate()` and a class error boundary. The gate had
 * hard-returned `false` since well before the scene was deleted - it rendered
 * inconsistently across desktop setups (blank on the owner's machine) and could
 * not be verified in CI - so the WebGL branch had been unreachable the whole
 * time, and the boundary was catching errors from a component that could never
 * mount.
 *
 * That was not free. `three` + `@react-three/fiber` + `@react-three/drei`
 * built an **856 KB chunk, the largest in the bundle**. Measured in a real
 * browser it was never fetched, on mobile or desktop, before or after a full
 * page scroll - `dynamic()` did its job - so it cost visitors nothing and cost
 * every build, deploy and `npm install` the full amount. Dead weight that is
 * genuinely invisible in production is the kind that survives longest.
 *
 * If the cinematic scene comes back, it comes back as its own verified piece of
 * work with a capability gate that has been shown to work on real hardware -
 * not as a branch kept warm in case someone gets to it.
 */
const CssOrbital = dynamic(() => import("./OrbitalEcosystem").then((m) => m.OrbitalEcosystem), {
  ssr: false,
  loading: Placeholder,
});

export function OrbitalLazy() {
  return <CssOrbital />;
}
