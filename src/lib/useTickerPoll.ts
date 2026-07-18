"use client";

import { useSyncExternalStore } from "react";

export type TickerCoin = { symbol: string; name: string; price: number; change: number; image: string };
type TickerState = { coins: TickerCoin[] | null; live: boolean; loading: boolean };

const POLL_MS = 60_000; // matches /api/ticker's revalidate window

let state: TickerState = { coins: null, live: false, loading: true };
const listeners = new Set<() => void>();
let subscriberCount = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
let onVisible: (() => void) | null = null;

function emit() {
  for (const l of listeners) l();
}

async function load() {
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

function start() {
  if (intervalId) return; // a subscriber is already driving the poll
  load();
  intervalId = setInterval(() => {
    if (!document.hidden) load();
  }, POLL_MS);
  onVisible = () => {
    if (!document.hidden) load();
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
