"use client";

/**
 * How the chat surfaces FEEL and look to this member, on this device:
 * haptics, sounds, accent colour, text size and density.
 *
 * One small store, read through `useSyncExternalStore` with a fixed server
 * snapshot (the defaults) - so the server render and the hydrating client
 * render always agree, and the member's real choice applies on the very next
 * render. Reading localStorage during render would be the hydration-mismatch
 * class behind this project's worst bug (CLAUDE.md).
 */

import { useSyncExternalStore } from "react";

export type HapticLevel = "off" | "standard" | "strong";
export type SoundLevel = "off" | "messages" | "all";
export type ChatAccent = "auto" | "gold" | "mint" | "sky" | "violet" | "rose" | "mono";
export type ChatText = "s" | "m" | "l";
export type ChatDensity = "comfy" | "compact";

export type ChatFeel = {
  haptics: HapticLevel;
  /** Did the member choose haptics themselves? Then it overrides reduced-motion. */
  hapticsChosen: boolean;
  sound: SoundLevel;
  volume: number;
  accent: ChatAccent;
  text: ChatText;
  density: ChatDensity;
};

export const FEEL_KEY = "xyz.chat.feel";
const LEGACY_SOUND_KEY = "xyz:chatSound";

export const DEFAULT_FEEL: ChatFeel = Object.freeze({
  haptics: "standard",
  hapticsChosen: false,
  sound: "messages",
  volume: 0.6,
  accent: "auto",
  text: "m",
  density: "comfy",
}) as ChatFeel;

export const ACCENTS: ChatAccent[] = ["auto", "gold", "mint", "sky", "violet", "rose", "mono"];

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

/** Validate whatever is stored - a corrupted or older value must never break a render. */
export function parseFeel(raw: string | null, legacySound: string | null = null): ChatFeel {
  let j: Record<string, unknown> = {};
  try { j = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}; } catch { j = {}; }
  const vol = typeof j.volume === "number" && Number.isFinite(j.volume) ? Math.min(1, Math.max(0, j.volume)) : DEFAULT_FEEL.volume;
  // The room's old on/off sound toggle: an explicit "off" is honoured.
  const legacy: SoundLevel | null = legacySound === "0" ? "off" : legacySound === "1" ? "messages" : null;
  return {
    haptics: pick(j.haptics, ["off", "standard", "strong"] as const, DEFAULT_FEEL.haptics),
    hapticsChosen: j.hapticsChosen === true,
    sound: pick(j.sound, ["off", "messages", "all"] as const, legacy ?? DEFAULT_FEEL.sound),
    volume: vol,
    accent: pick(j.accent, ACCENTS, DEFAULT_FEEL.accent),
    text: pick(j.text, ["s", "m", "l"] as const, DEFAULT_FEEL.text),
    density: pick(j.density, ["comfy", "compact"] as const, DEFAULT_FEEL.density),
  };
}

let current: ChatFeel | null = null;
const listeners = new Set<() => void>();

export function getFeel(): ChatFeel {
  if (typeof window === "undefined") return DEFAULT_FEEL;
  if (!current) {
    try { current = parseFeel(localStorage.getItem(FEEL_KEY), localStorage.getItem(LEGACY_SOUND_KEY)); }
    catch { current = DEFAULT_FEEL; }
  }
  return current;
}

export function setFeel(patch: Partial<ChatFeel>): void {
  current = { ...getFeel(), ...patch };
  try { localStorage.setItem(FEEL_KEY, JSON.stringify(current)); } catch { /* storage blocked: session-only */ }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => { if (e.key === FEEL_KEY) { current = null; l(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
}

/** The member's feel settings. Server render and hydration see the defaults. */
export function useChatFeel(): ChatFeel {
  return useSyncExternalStore(subscribe, getFeel, () => DEFAULT_FEEL);
}

/** Data attributes that let CSS apply accent / text size / density. */
export function feelAttrs(f: ChatFeel): Record<string, string> {
  return { "data-accent": f.accent, "data-text": f.text, "data-density": f.density };
}
