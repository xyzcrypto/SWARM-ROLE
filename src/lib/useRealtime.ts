"use client";

import { useEffect, useRef } from "react";
import { getRealtimeClient } from "./realtimeClient";

/**
 * Pure decision used by the hook (and unit-tested): prefer realtime when Supabase
 * is configured, else poll when a `pollMs` is given, else do nothing.
 */
export function realtimeMode(
  url?: string | null,
  anonKey?: string | null,
  pollMs?: number
): "realtime" | "poll" | "off" {
  if (url && anonKey) return "realtime";
  if (pollMs && pollMs > 0) return "poll";
  return "off";
}

type UseRealtimeOpts = {
  channel: string;
  event: string;
  onMessage: (payload: unknown) => void;
  url?: string;
  anonKey?: string;
  /** Fallback poll interval (ms) used only when realtime isn't configured. */
  pollMs?: number;
  enabled?: boolean;
};

/**
 * The shared "live or poll" primitive for the site's realtime surfaces.
 *
 * When Supabase realtime is configured it subscribes to a broadcast
 * channel/event and calls `onMessage(payload)` on each push (the server emits a
 * tiny invalidation ping; the client then refetches a cached endpoint - no row
 * streaming, minimal DB load). When realtime isn't available it falls back to
 * polling `onMessage(null)` every `pollMs` while the tab is visible. Fully
 * degrades - no-op if neither realtime nor `pollMs` is provided.
 */
export function useRealtime({ channel, event, onMessage, url, anonKey, pollMs, enabled = true }: UseRealtimeOpts) {
  const cb = useRef(onMessage);
  cb.current = onMessage;

  const u = url ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const k = anonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!enabled) return;
    const mode = realtimeMode(u, k, pollMs);
    if (mode === "off") return;

    // Preferred path: realtime broadcast (DB-light).
    if (mode === "realtime" && u && k) {
      let cleanup: (() => void) | undefined;
      let cancelled = false;
      (async () => {
        const client = await getRealtimeClient(u, k);
        if (cancelled) return;
        const ch = client.channel(channel);
        ch.on("broadcast", { event }, ({ payload }) => cb.current(payload)).subscribe();
        cleanup = () => client.removeChannel(ch);
      })();
      return () => {
        cancelled = true;
        cleanup?.();
      };
    }

    // Fallback path: poll while visible.
    if (pollMs && pollMs > 0) {
      const id = setInterval(() => {
        if (typeof document === "undefined" || document.visibilityState === "visible") cb.current(null);
      }, pollMs);
      return () => clearInterval(id);
    }
  }, [u, k, channel, event, pollMs, enabled]);
}
