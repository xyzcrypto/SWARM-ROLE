"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

/**
 * Real-time spot prices straight from Binance's public market-data stream
 * (wss://data-stream.binance.vision, read-only, no key), shared by every
 * component on the page.
 *
 * Why it is built this way (an earlier attempt on the heatmap was removed):
 * - ONE socket per tab, ref-counted: components subscribe to the symbols they
 *   show and the manager SUBSCRIBEs/UNSUBSCRIBEs just those streams. The old
 *   version used `!miniTicker@arr` (every symbol on the exchange, every second).
 * - React hears about it at most every FLUSH_MS, in one batch, so a page with
 *   60 tiles re-renders ~once a second, not 60 times.
 * - The socket closes while the tab is hidden and reopens when it is shown.
 * - The host is allowed in the CSP (`connect-src`, next.config.mjs); the old
 *   socket was blocked by CSP and reconnected every 4 s forever. Here, after
 *   MAX_FAILS failed connects in a row, it stops trying and the page keeps the
 *   polled /api/markets data it already has.
 * - It costs no Vercel usage at all: browser to Binance directly.
 *
 * Prices are Binance's last trade against USDT; 24h change is
 * (last - open24h) / open24h, which is what Binance itself displays.
 */

export type LivePrice = { price: number; change24h: number; at: number };
type Prices = Readonly<Record<string, LivePrice>>;

const URL_WS = "wss://data-stream.binance.vision/ws";
const FLUSH_MS = 1200;
const MAX_FAILS = 5;
// Stablecoins and wrapped duplicates: no meaningful USDT pair (or exactly 1).
const SKIP = new Set(["USDT", "USDC", "DAI", "FDUSD", "TUSD", "USDE", "USDS", "PYUSD", "WBTC", "WETH", "STETH", "WSTETH", "WEETH", "WBETH", "BUSD"]);

const counts = new Map<string, number>(); // BASE -> number of subscribers
let ws: WebSocket | null = null;
let open = false;
let fails = 0;
let gaveUp = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let nextId = 1;
let snapshot: Prices = {};
let pending: Record<string, LivePrice> = {};
let connected = false;
const listeners = new Set<() => void>();

const stream = (base: string) => `${base.toLowerCase()}usdt@miniTicker`;

function emit() {
  listeners.forEach((l) => l());
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (!Object.keys(pending).length) return;
    snapshot = { ...snapshot, ...pending };
    pending = {};
    emit();
  }, FLUSH_MS);
}

function send(method: "SUBSCRIBE" | "UNSUBSCRIBE", bases: string[]) {
  if (!ws || !open || !bases.length) return;
  // Binance accepts up to 1024 streams per connection and ~5 messages/s.
  ws.send(JSON.stringify({ method, params: bases.map(stream), id: nextId++ }));
}

function connect() {
  if (ws || gaveUp || typeof window === "undefined" || typeof WebSocket === "undefined") return;
  if (document.hidden || counts.size === 0) return;
  let sock: WebSocket;
  try {
    sock = new WebSocket(URL_WS);
  } catch {
    fail();
    return;
  }
  ws = sock;
  sock.onopen = () => {
    open = true;
    fails = 0;
    connected = true;
    emit();
    send("SUBSCRIBE", [...counts.keys()]);
  };
  sock.onmessage = (ev) => {
    try {
      const m = JSON.parse(ev.data as string) as { e?: string; s?: string; c?: string; o?: string };
      if (m.e !== "24hrMiniTicker" || !m.s || !m.c) return;
      const base = m.s.endsWith("USDT") ? m.s.slice(0, -4) : m.s;
      const price = Number(m.c);
      const openP = Number(m.o);
      if (!Number.isFinite(price) || price <= 0) return;
      pending[base] = { price, change24h: openP > 0 ? ((price - openP) / openP) * 100 : 0, at: Date.now() };
      scheduleFlush();
    } catch {
      /* ignore malformed frames */
    }
  };
  sock.onclose = () => {
    const wasOpen = open;
    ws = null;
    open = false;
    if (connected) {
      connected = false;
      emit();
    }
    if (!wasOpen) fail();
    else if (!document.hidden && counts.size) schedule(1500);
  };
  sock.onerror = () => {
    try {
      sock.close();
    } catch {
      /* already closed */
    }
  };
}

function fail() {
  fails += 1;
  if (fails >= MAX_FAILS) {
    gaveUp = true; // blocked network / region: stay on polled data
    return;
  }
  schedule(Math.min(30_000, 1500 * 2 ** fails));
}

function schedule(ms: number) {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    connect();
  }, ms);
}

function disconnect() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (ws) {
    const s = ws;
    ws = null;
    open = false;
    s.onclose = null;
    try {
      s.close();
    } catch {
      /* ignore */
    }
  }
  if (connected) {
    connected = false;
    emit();
  }
}

let visibilityBound = false;
function bindVisibility() {
  if (visibilityBound || typeof document === "undefined") return;
  visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) disconnect();
    else connect();
  });
}

function add(bases: string[]) {
  const fresh: string[] = [];
  for (const b of bases) {
    const n = counts.get(b) ?? 0;
    counts.set(b, n + 1);
    if (n === 0) fresh.push(b);
  }
  bindVisibility();
  if (ws && open) send("SUBSCRIBE", fresh);
  else connect();
}

function remove(bases: string[]) {
  const gone: string[] = [];
  for (const b of bases) {
    const n = counts.get(b) ?? 0;
    if (n <= 1) {
      counts.delete(b);
      gone.push(b);
    } else counts.set(b, n - 1);
  }
  send("UNSUBSCRIBE", gone);
  if (counts.size === 0) disconnect();
}

/** Normalise and filter the symbols a component wants live. Pure, for tests. */
export function liveBases(symbols: readonly string[], max = 120): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of symbols) {
    const b = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!b || SKIP.has(b) || seen.has(b)) continue;
    seen.add(b);
    out.push(b);
    if (out.length >= max) break;
  }
  return out;
}

/** Latest live prices without subscribing (for one-off reads, e.g. AneQue's brief). */
export const getLivePrices = (): Prices => snapshot;

/** Internals, exported for the unit test (fake WebSocket + fake timers). */
export const __live = {
  add,
  remove,
  snapshot: () => snapshot,
  connected: () => connected,
  reset() {
    disconnect();
    counts.clear();
    snapshot = {};
    pending = {};
    fails = 0;
    gaveUp = false;
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
  },
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const EMPTY: Prices = {};
const getSnap = () => snapshot;
const getServer = () => EMPTY;
const getConnected = () => connected;
const getConnectedServer = () => false;

/**
 * Live prices for `symbols` (e.g. ["BTC", "ETH"]). Returns the shared map
 * (keyed by upper-case base symbol) and whether the stream is up. Before the
 * first frame, or if Binance is unreachable, the map simply lacks the symbol
 * and callers keep showing their polled value.
 */
export function useLivePrices(symbols: readonly string[]): { prices: Prices; live: boolean } {
  const key = liveBases(symbols).join(",");
  useEffect(() => {
    if (!key) return;
    const bases = key.split(",");
    add(bases);
    return () => remove(bases);
  }, [key]);
  const prices = useSyncExternalStore(subscribe, getSnap, getServer);
  const live = useSyncExternalStore(subscribe, getConnected, getConnectedServer);
  return useMemo(() => ({ prices, live }), [prices, live]);
}

/**
 * Apply a live price to a polled row, unless it disagrees with the polled
 * price by more than 25%: then the symbol on Binance is probably a different
 * asset with the same ticker, and the polled (CoinGecko) value is kept. Pure.
 */
export function overlayLive<T extends { symbol: string; price: number; change24h: number }>(row: T, prices: Prices): T {
  const l = prices[row.symbol.toUpperCase()];
  if (!l) return row;
  if (row.price > 0 && Math.abs(l.price - row.price) / row.price > 0.25) return row;
  return { ...row, price: l.price, change24h: l.change24h };
}
