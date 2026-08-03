"use client";

import { useEffect, useState } from "react";
import { joinSharedChannel } from "@/lib/sharedChannel";

// Public client-safe Supabase creds (inlined by Next at build). When unset the
// hook is a no-op returning 0, so callers degrade gracefully.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Live "online now" count from the shared `site-visitors` Supabase presence
 * channel. By default it only OBSERVES (does not register its own presence key)
 * so it never double-counts a browser that already announces itself via
 * <RealtimeSession>. Admin surfaces pass `track: true` to also announce.
 */
export function useLivePresence(opts?: { track?: boolean; keyPrefix?: string }): number {
  const track = opts?.track ?? false;
  const keyPrefix = opts?.keyPrefix ?? "obs";
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      // Only pass a presence key when this hook is meant to APPEAR in the count
      // (`track`). Observers must not, or they would each try to claim the one
      // shared channel's key - the cause of the "after subscribe()" throw.
      const ch = joinSharedChannel(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        "site-visitors",
        track ? `${keyPrefix}-${Math.random().toString(36).slice(2)}` : undefined
      );
      const offP = ch.onPresence((state) => setCount(Object.keys(state).length));
      const offS = track ? ch.onStatus((status) => { if (status === "SUBSCRIBED") ch.track({ at: Date.now() }); }) : undefined;
      cleanup = () => { offP(); offS?.(); ch.release(); };
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [track, keyPrefix]);

  return count;
}
