"use client";

import dynamic from "next/dynamic";
import { XYZ_CMDK_EVENT } from "@/lib/command-search";
import { useDeferredMount } from "@shared/hooks/useIdleGate";

// Code-split the palette into its own chunk, and load it once the page is idle
// (or the moment someone asks for it: the navbar search, Cmd/Ctrl+K, "/"),
// so the global search costs nothing while the page itself is loading.
const CommandPalette = dynamic(() => import("./CommandPalette").then((m) => m.CommandPalette), { ssr: false });

/** The palette's own shortcuts, so a key press before it loads is not lost. */
function opensPalette(e: KeyboardEvent): boolean {
  if (!e.key) return false;
  const k = e.key.toLowerCase();
  const el = e.target as HTMLElement | null;
  const typing = /^(input|textarea|select)$/i.test(el?.tagName || "") || !!el?.isContentEditable;
  return ((e.metaKey || e.ctrlKey) && k === "k") || (k === "/" && !typing);
}

export function CommandPaletteMount() {
  return useDeferredMount(XYZ_CMDK_EVENT, opensPalette) ? <CommandPalette /> : null;
}
