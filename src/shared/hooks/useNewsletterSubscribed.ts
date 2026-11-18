"use client";

import { useSyncExternalStore } from "react";

/**
 * "This browser has already subscribed to the newsletter", so the capture cards
 * stop asking. Set on a 2xx from `/api/subscribe` (news panel or footer).
 *
 * `useSyncExternalStore` with a `false` server snapshot: the server and the
 * hydration pass both render the card, then it disappears on the client. That is
 * the pattern CLAUDE.md requires for anything derived from a client-only signal;
 * reading localStorage during render would hand React a different DOM than the
 * server sent (#418).
 */
const KEY = "xyz:newsletter:subscribed";
const EVENT = "xyz:newsletter";

/** Non-reactive read, for an effect that decides once on mount. */
export function isNewsletterSubscribed(): boolean {
  return read();
}

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useNewsletterSubscribed(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

export function markNewsletterSubscribed(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* blocked storage: the card simply keeps showing */
  }
  window.dispatchEvent(new Event(EVENT));
}
