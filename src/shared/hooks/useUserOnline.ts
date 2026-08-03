"use client";

import { useEffect, useState } from "react";
import { joinSharedChannel } from "@/lib/sharedChannel";

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
// The full set of userIds currently online anywhere on the site. One shared
// `site-visitors` subscription for the whole page (cheaper than one channel per
// row). Empty set when realtime env is absent.
export function useOnlineSet(): Set<string> {
  const [set, setSet] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      // Observer only - no presence key. RealtimeSession represents the tab;
      // this used to impose its own key on the same shared channel, which is
      // what threw "cannot add presence callbacks after subscribe()".
      const ch = joinSharedChannel(SUPABASE_URL, SUPABASE_ANON_KEY, "site-visitors");
      const off = ch.onPresence((state) => setSet(new Set(Object.keys(state))));
      cleanup = () => { off(); ch.release(); };
    })();
    return () => { cancelled = true; cleanup?.(); };
  }, []);
  return set;
}

export function useUserOnline(userId: string | null | undefined): boolean {
  const [online, setOnline] = useState(false);

  // Switching to a different user starts from "offline" until that user's
  // presence actually arrives. Adjusted during render so the previous user's
  // online dot is never shown against the new one.
  const [prevUserId, setPrevUserId] = useState(userId);
  if (prevUserId !== userId) {
    setPrevUserId(userId);
    setOnline(false);
  }

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !userId) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      const ch = joinSharedChannel(SUPABASE_URL, SUPABASE_ANON_KEY, "site-visitors");
      const off = ch.onPresence((state) => {
        setOnline(Object.prototype.hasOwnProperty.call(state, userId));
      });
      cleanup = () => { off(); ch.release(); };
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [userId]);

  return online;
}
