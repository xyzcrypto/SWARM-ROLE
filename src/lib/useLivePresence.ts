"use client";

import { useEffect, useState } from "react";

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
      const { createClient } = await import("@supabase/supabase-js");
      if (cancelled) return;
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const ch = client.channel("site-visitors", {
        config: { presence: { key: `${keyPrefix}-${Math.random().toString(36).slice(2)}` } },
      });
      ch.on("presence", { event: "sync" }, () => setCount(Object.keys(ch.presenceState()).length)).subscribe(
        (status) => {
          if (status === "SUBSCRIBED" && track) ch.track({ at: Date.now() });
        }
      );
      cleanup = () => client.removeChannel(ch);
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [track, keyPrefix]);

  return count;
}
