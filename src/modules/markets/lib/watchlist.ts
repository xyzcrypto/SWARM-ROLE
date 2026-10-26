"use client";

/**
 * One watchlist for the whole Markets page.
 *
 * Before this, three components each kept their own copy: the Top Assets star
 * only changed its own local state and never saved, so starring a coin there
 * did not add it to "My Watchlist"; the widget and the Watchlist tab each read
 * localStorage once and drifted apart after any change.
 *
 * `useSyncExternalStore` with a server snapshot keeps the first client render
 * identical to the server one (the defaults), then switches to the saved list,
 * so there is no hydration mismatch (React #418).
 */

import { useSyncExternalStore } from "react";

export const WATCHLIST_KEY = "xyz_user_watchlist";
export const WATCHLIST_EVENT = "watchlist-updated";
export const DEFAULT_WATCHLIST: readonly string[] = ["bitcoin", "ethereum", "solana", "hyperliquid", "sui"];

const DEFAULT_SET: ReadonlySet<string> = new Set(DEFAULT_WATCHLIST);
let cachedRaw: string | null | undefined;
let cachedSet: ReadonlySet<string> = DEFAULT_SET;

function read(): ReadonlySet<string> {
  let raw: string | null = null;
  try { raw = localStorage.getItem(WATCHLIST_KEY); } catch { /* private mode */ }
  if (raw === cachedRaw) return cachedSet;
  cachedRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    cachedSet = Array.isArray(parsed) ? new Set(parsed.filter((x): x is string => typeof x === "string")) : DEFAULT_SET;
  } catch {
    cachedSet = DEFAULT_SET;
  }
  return cachedSet;
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => { if (e.key === WATCHLIST_KEY) cb(); };
  window.addEventListener(WATCHLIST_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(WATCHLIST_EVENT, cb); window.removeEventListener("storage", onStorage); };
}

export function writeWatchlist(next: Iterable<string>) {
  try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...new Set(next)])); } catch { /* private mode: stays in memory for this view */ }
  window.dispatchEvent(new Event(WATCHLIST_EVENT));
}

export function toggleWatchlist(id: string) {
  const cur = new Set(read());
  if (cur.has(id)) cur.delete(id);
  else cur.add(id);
  writeWatchlist(cur);
  return cur.has(id);
}

export function useWatchlist(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_SET);
}
