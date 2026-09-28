"use client";

/**
 * Website-wide display preferences: the "Customize website" panel.
 *
 * Everything here is a CLASS ON <html>, set before first paint by the inline
 * script in app/layout.tsx and live by `setSitePrefs` below. CSS reads the
 * classes; nothing in the React tree renders differently from them, so they
 * can never cause a hydration mismatch (CLAUDE.md, #418).
 *
 *   theme      "dark" | "light"                  -> html.dark        (existing key `theme`)
 *   motion     "auto" | "full" | "lite" | "off"  -> lite-motion / motion-full / motion-off
 *                                                   (existing key `motion`; "off" is new)
 *   scale      90 | 100 | 110 | 125             -> text-scale-*     (key `xyz.ui`)
 *   effects    background animations on/off      -> no-effects
 *   blur       glass blur on/off                 -> no-blur
 */

import { useSyncExternalStore } from "react";

export type Motion = "auto" | "full" | "lite" | "off";
export type Scale = 90 | 100 | 110 | 125;
export type SitePrefs = { theme: "dark" | "light"; motion: Motion; scale: Scale; effects: boolean; blur: boolean };

export const DEFAULT_SITE: SitePrefs = Object.freeze({ theme: "dark", motion: "auto", scale: 100, effects: true, blur: true }) as SitePrefs;
export const UI_KEY = "xyz.ui";
const SCALES: Scale[] = [90, 100, 110, 125];

/** Validate stored values - corrupted storage must never break the page. */
export function parseSitePrefs(theme: string | null, motion: string | null, ui: string | null): SitePrefs {
  let j: Record<string, unknown> = {};
  try { j = ui ? (JSON.parse(ui) as Record<string, unknown>) : {}; } catch { j = {}; }
  const scale = SCALES.includes(j.scale as Scale) ? (j.scale as Scale) : 100;
  return {
    theme: theme === "light" ? "light" : "dark",
    motion: motion === "full" || motion === "lite" || motion === "off" ? motion : "auto",
    scale,
    effects: j.effects !== false,
    blur: j.blur !== false,
  };
}

let current: SitePrefs | null = null;
const listeners = new Set<() => void>();

export function getSitePrefs(): SitePrefs {
  if (typeof window === "undefined") return DEFAULT_SITE;
  if (!current) {
    try { current = parseSitePrefs(localStorage.getItem("theme"), localStorage.getItem("motion"), localStorage.getItem(UI_KEY)); }
    catch { current = DEFAULT_SITE; }
  }
  return current;
}

/** Apply prefs to <html>. Mirrors the pre-paint script in layout.tsx exactly. */
export function applySitePrefs(p: SitePrefs, root: HTMLElement = document.documentElement): void {
  root.classList.toggle("dark", p.theme === "dark");
  root.classList.toggle("motion-full", p.motion === "full");
  root.classList.toggle("motion-off", p.motion === "off");
  // "auto" keeps whatever the device-class heuristic decided at load.
  if (p.motion === "lite" || p.motion === "off") root.classList.add("lite-motion");
  if (p.motion === "full") root.classList.remove("lite-motion");
  for (const s of SCALES) root.classList.toggle(`text-scale-${s}`, s !== 100 && p.scale === s);
  root.classList.toggle("no-effects", !p.effects);
  root.classList.toggle("no-blur", !p.blur);
}

export function setSitePrefs(patch: Partial<SitePrefs>): void {
  const next = { ...getSitePrefs(), ...patch };
  current = next;
  try {
    localStorage.setItem("theme", next.theme);
    if (next.motion === "auto") localStorage.removeItem("motion"); else localStorage.setItem("motion", next.motion);
    localStorage.setItem(UI_KEY, JSON.stringify({ scale: next.scale, effects: next.effects, blur: next.blur }));
  } catch { /* storage blocked - applies for this visit only */ }
  applySitePrefs(next);
  listeners.forEach((l) => l());
}

export function resetSitePrefs(): void {
  try { localStorage.removeItem(UI_KEY); localStorage.removeItem("motion"); } catch { /* ignore */ }
  setSitePrefs({ ...DEFAULT_SITE, theme: getSitePrefs().theme });
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === UI_KEY || e.key === "motion" || e.key === "theme") { current = null; applySitePrefs(getSitePrefs()); l(); }
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
}

/** The member's site prefs. Server render and hydration see the defaults. */
export function useSitePrefs(): SitePrefs {
  return useSyncExternalStore(subscribe, getSitePrefs, () => DEFAULT_SITE);
}

/** Open the Customize sheet from anywhere (navbar, side menu, settings). */
export const CUSTOMIZE_EVENT = "xyz-customize";
export const openCustomize = () => window.dispatchEvent(new Event(CUSTOMIZE_EVENT));
