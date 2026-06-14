"use client";

import dynamic from "next/dynamic";

// The candlestick chart is a below-the-fold, purely-visual client component -
// skip SSR and load its JS after hydration so it never blocks first paint.
export const PerpChartLazy = dynamic(
  () => import("./PerpChart").then((m) => m.PerpChart),
  {
    ssr: false,
    loading: () => (
      // Mirrors the real chart card's footprint to avoid layout shift.
      <div className="h-[166px] w-full animate-pulse rounded-2xl border border-line bg-ink-950/60" />
    ),
  }
);
