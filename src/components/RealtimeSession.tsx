"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

/**
 * Site-wide realtime + analytics glue, mounted once in the root layout:
 *  - records a page view on each navigation (POST /api/track),
 *  - joins the global `site-visitors` presence channel (powers the admin
 *    live-online count),
 *  - for logged-in users, listens on `user:<id>` for `membership_changed` and
 *    refreshes the session so the Premium icon updates instantly (no re-login).
 * Degrades gracefully: page-view tracking works without realtime; presence /
 * membership push only run when the Supabase public env is set.
 */
export function RealtimeSession({ url, anonKey }: { url: string; anonKey: string }) {
  const pathname = usePathname();
  const { data: session, update } = useSession();
  const userId = (session?.user as any)?.id as string | undefined;
  const lastPath = useRef<string | null>(null);

  // Page-view ping (once per navigation).
  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return;
    lastPath.current = pathname;
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  // Presence + membership realtime.
  useEffect(() => {
    if (!url || !anonKey) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const { createClient } = await import("@supabase/supabase-js");
      if (cancelled) return;
      const client = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      // Global presence for the live-visitor count.
      const presenceKey = userId || `guest-${Math.random().toString(36).slice(2)}`;
      const site = client.channel("site-visitors", { config: { presence: { key: presenceKey } } });
      site.subscribe((status) => {
        if (status === "SUBSCRIBED") site.track({ at: Date.now() });
      });

      // Per-user channel: live membership changes → refresh the session.
      let userCh: ReturnType<typeof client.channel> | null = null;
      if (userId) {
        userCh = client.channel(`user:${userId}`);
        userCh
          .on("broadcast", { event: "membership_changed" }, () => {
            update();
          })
          .subscribe();
      }

      cleanup = () => {
        client.removeChannel(site);
        if (userCh) client.removeChannel(userCh);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [url, anonKey, userId, update]);

  return null;
}
