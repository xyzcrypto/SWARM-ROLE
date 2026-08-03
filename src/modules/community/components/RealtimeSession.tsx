"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { getRealtimeClient } from "@/lib/realtimeClient";
import { chatOwnsPresence, SITE_BEAT_MS } from "@/lib/presence";

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
  //
  // The presence half now has a server-backed fallback, for the same reason the
  // chat room got one: when the Supabase channel cannot connect, the admin's
  // "Live online" read a flat 0 while the site was in use. A heartbeat writes
  // the caller's row so that number has a real source to fall back to.
  //
  // Two rules keep it cheap and correct:
  //  - it only runs while the channel is NOT subscribed, so a healthy
  //    deployment makes zero extra requests;
  //  - it does not run on /community, where ChatClient owns the same row at a
  //    faster beat. The row is keyed by user, so two writers would flip its
  //    `room` back and forth and the chat's own count would lose people.
  const onChat = chatOwnsPresence(pathname);
  const liveRef = useRef(false);

  useEffect(() => {
    if (!url || !anonKey) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const client = await getRealtimeClient(url, anonKey);
      if (cancelled) return;

      // Global presence for the live-visitor count.
      const presenceKey = userId || `guest-${Math.random().toString(36).slice(2)}`;
      const site = client.channel("site-visitors", { config: { presence: { key: presenceKey } } });
      site.subscribe((status) => {
        liveRef.current = status === "SUBSCRIBED";
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
          // Staff permissions changed → refresh the session so gates update live.
          .on("broadcast", { event: "access_changed" }, () => {
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
      liveRef.current = false;
      cleanup?.();
    };
  }, [url, anonKey, userId, update]);

  // Server-backed heartbeat. Signed-in only (the endpoint needs a session), off
  // on /community, off while the tab is hidden, and it skips the REQUEST - not
  // just the result - whenever the realtime channel is healthy.
  useEffect(() => {
    if (!userId || onChat) return;

    const beat = () => {
      if (document.hidden || liveRef.current) return;
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => {});
    };
    const leave = () => {
      try {
        navigator.sendBeacon?.(
          "/api/presence",
          new Blob([JSON.stringify({ leave: true })], { type: "application/json" })
        );
      } catch {
        /* nothing useful to do while unloading */
      }
    };

    beat();
    const timer = setInterval(beat, SITE_BEAT_MS);
    // Coming back to the tab should re-announce immediately - the beat pauses
    // while hidden and the beacon has just removed the row, so without this you
    // would be invisible for up to a full interval after returning.
    const onVisibility = () => (document.visibilityState === "hidden" ? leave() : beat());
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", leave);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [userId, onChat]);

  return null;
}
