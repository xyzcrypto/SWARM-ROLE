"use client";

import { useEffect, useState } from "react";

// Public client-safe Supabase creds (inlined by Next at build). When unset the
// hook is a no-op returning false, so callers degrade gracefully (no dot).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Is a specific user currently online anywhere on the site? Observes the shared
 * `site-visitors` Supabase presence channel, where every logged-in browser
 * announces itself with its userId as the presence key (via <RealtimeSession>).
 * Observe-only (never tracks its own key), so it can't double-count or masquerade.
 * Returns false when realtime env is absent or userId is falsy.
 */
export function useUserOnline(userId: string | null | undefined): boolean {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    setOnline(false);
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !userId) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { createClient } = await import("@supabase/supabase-js");
      if (cancelled) return;
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const ch = client.channel("site-visitors", {
        config: { presence: { key: `dm-obs-${Math.random().toString(36).slice(2)}` } },
      });
      ch.on("presence", { event: "sync" }, () => {
        setOnline(Object.prototype.hasOwnProperty.call(ch.presenceState(), userId));
      }).subscribe();
      cleanup = () => client.removeChannel(ch);
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [userId]);

  return online;
}
