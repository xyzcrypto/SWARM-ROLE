"use client";

import { useEffect, useState } from "react";

/**
 * Resolves once the page has finished its own loading: after `window.load`
 * (capped at `maxWaitMs`, so a slow image cannot hold it back for ever) and
 * then an idle moment. Shared, so every caller waits on the same gate.
 *
 * Why: on a phone with a weak connection, everything that starts during the
 * first seconds competes for the same thin pipe. The realtime client (~50 KB
 * plus a WebSocket handshake), the AI widget, the command palette and the
 * customize sheet all used to start downloading the moment the page hydrated,
 * while the page's own data and images were still on their way. None of them
 * is needed to read or use the page in those seconds.
 */
let gate: Promise<void> | null = null;

export function whenIdle(maxWaitMs = 6000): Promise<void> {
  if (typeof window === "undefined") return new Promise(() => {});
  if (gate) return gate;
  gate = new Promise<void>((resolve) => {
    let done = false;
    const idle = () => {
      if (done) return;
      done = true;
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      if (ric) ric(() => resolve(), { timeout: 2000 });
      else setTimeout(resolve, 300);
    };
    if (document.readyState === "complete") idle();
    else {
      window.addEventListener("load", idle, { once: true });
      setTimeout(idle, maxWaitMs);
    }
  });
  return gate;
}

/** True once whenIdle() has resolved; false on the server and during the first render. */
export function useIdleGate(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void whenIdle().then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

/**
 * Opens that arrived before a deferred component had loaded. The component
 * consumes its entry on mount and opens itself, so a tap on Search in the
 * first seconds is answered (late by a moment) instead of being lost.
 */
const pending = new Set<string>();
export function consumePending(event: string): boolean {
  const had = pending.has(event);
  pending.delete(event);
  return had;
}

/**
 * Mount a lazy, on-demand UI (command palette, customize sheet) once the page
 * is idle, or immediately when it is asked for first: its window `event`
 * fires, or a key matching `matchKey` is pressed.
 */
export function useDeferredMount(event: string, matchKey?: (e: KeyboardEvent) => boolean): boolean {
  const idle = useIdleGate();
  const [asked, setAsked] = useState(false);
  useEffect(() => {
    if (idle || asked) return;
    const ask = () => {
      pending.add(event);
      setAsked(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (matchKey?.(e)) {
        e.preventDefault();
        ask();
      }
    };
    window.addEventListener(event, ask);
    if (matchKey) window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(event, ask);
      if (matchKey) window.removeEventListener("keydown", onKey);
    };
  }, [idle, asked, event, matchKey]);
  return idle || asked;
}
