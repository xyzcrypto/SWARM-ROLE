"use client";

import { useSyncExternalStore } from "react";
import { wakeIsDue } from "@shared/hooks/useLiveData";

export type TickerCoin = { symbol: string; name: string; price: number; change: number; image: string };
type TickerState = { coins: TickerCoin[] | null; live: boolean; loading: boolean };

// Was 60s - polling slower than that just re-fetches the same cached response
// and burns Function Invocations for nothing.
//
// Paired with `revalidate` / `s-maxage` in app/api/ticker/route.ts, which must
// stay LARGER than this. They were 60s against this 150s poll, so the cache had
// always expired ~90s before each poll arrived: every single poll missed and
// regenerated, which made this the top driver of the ISR Writes overage. If you
// change this number, change that one too.
const POLL_MS = 5_000;

let state: TickerState = { coins: null, live: false, loading: true };
const listeners = new Set<() => void>();
let subscriberCount = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
let onVisible: (() => void) | null = null;
// When the last request STARTED - see `wakeIsDue`.
let lastRunAt = 0;

function emit() {
  for (const l of listeners) l();
}

async function load() {
  lastRunAt = Date.now();
  try {
    const res = await fetch("/api/ticker", { cache: "no-store" });
    if (!res.ok) throw new Error("bad status");
    const data = await res.json();
    if (!Array.isArray(data.coins) || !data.coins.length) return;
    state = { coins: data.coins, live: Boolean(data.live), loading: false };
  } catch {
    state = { ...state, live: false, loading: false };
  }
  emit();
}

// This one keeps its own loop rather than moving to `useLiveData`: it is a
// module-level store deliberately shared by every consumer on the page (see the
// hook's doc comment below), so there is no component to own the hook. It does
// borrow the hook's wake rule, which is the part that had the bug.
function start() {
  if (intervalId) return; // a subscriber is already driving the poll
  load();
  intervalId = setInterval(() => {
    if (!document.hidden) load();
  }, POLL_MS);
  onVisible = () => {
    // Was: refetch on EVERY return to the tab. /api/ticker is cached for longer
    // than this poll, so a glance at the tab could only ever re-fetch the same
    // bytes - and this store backs the ticker on nearly every page.
    if (!document.hidden && wakeIsDue(Date.now(), lastRunAt, POLL_MS)) load();
  };
  document.addEventListener("visibilitychange", onVisible);
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (onVisible) {
    document.removeEventListener("visibilitychange", onVisible);
    onVisible = null;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  subscriberCount++;
  if (subscriberCount === 1) start();
  return () => {
    listeners.delete(listener);
    subscriberCount--;
    if (subscriberCount === 0) stop();
  };
}

function getSnapshot(): TickerState {
  return state;
}

/**
 * Shared /api/ticker poll, deduped across every consumer on the page via a
 * module-level external store (React's useSyncExternalStore). MarketTicker
 * (navbar/homepage marquee) and LiveMarketVisual (Products "Web3 Market"
 * card) previously ran two fully independent 60s intervals fetching the
 * exact same endpoint - doubling request volume on every homepage view for
 * no benefit. Now there's exactly one fetch + one interval regardless of how
 * many components use this hook at once; it starts on first subscriber and
 * stops when the last one unmounts.
 */
export function useTickerPoll(): TickerState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
