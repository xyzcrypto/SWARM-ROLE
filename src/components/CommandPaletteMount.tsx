"use client";

import dynamic from "next/dynamic";

// Code-split the palette into its own chunk (loaded after hydration, not in the
// initial bundle) so the global search costs ~0 on first paint.
const CommandPalette = dynamic(() => import("./CommandPalette").then((m) => m.CommandPalette), { ssr: false });

export function CommandPaletteMount() {
  return <CommandPalette />;
}
