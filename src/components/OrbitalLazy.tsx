"use client";

import dynamic from "next/dynamic";

// Below-the-fold, animation-only — defer its JS so it never blocks the
// homepage's first paint/hydration. A same-size placeholder avoids layout shift.
const OrbitalEcosystem = dynamic(
  () => import("./OrbitalEcosystem").then((m) => m.OrbitalEcosystem),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto aspect-square w-full max-w-[20rem] animate-pulse rounded-full bg-white/[0.02] sm:max-w-md lg:max-w-xl" />
    ),
  }
);

export function OrbitalLazy() {
  return <OrbitalEcosystem />;
}
