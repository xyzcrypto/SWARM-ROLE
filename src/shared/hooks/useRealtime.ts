"use client";

import { useEffect, useRef } from "react";
import { joinSharedChannel } from "@/lib/sharedChannel";

/**
 * Pure decision used by the hook (and unit-tested): prefer realtime when Supabase
 * is configured, else poll when a `pollMs` is given, else do nothing.
 *
 * Note what this does NOT decide: whether the poll is armed. It used to, and
 * that was the bug - see the hook below. "realtime" here means "there is a
 * connection worth attempting", not "polling is unnecessary".
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

/**
 * How often to refetch while the channel is DOWN and the caller named no
 * interval of its own. Deliberately slow: it exists so a surface cannot go
 * permanently silent, not to be a primary transport. Callers that want fresher
 * data pass their own `pollMs`.
 */
const FALLBACK_POLL_MS = 60_000;

/** Don't let focus/visibility/online churn turn into a request storm. */
const WAKE_MIN_GAP_MS = 4_000;

type UseRealtimeOpts = {
  channel: string;
  event: string;
  /**
   * Called with a payload on a realtime push, or `null` meaning "refetch".
   *
   * **Return the promise if it is async, and let it REJECT on failure.** That
   * is what arms the retry below. Every loader in this codebase used to
   * a bare `catch` that ignored the error internally, which made a failed request
   * indistinguishable from a successful one - so the poll simply waited out a
   * whole interval and the surface sat on stale data. Swallowing the error
   * inside the loader silently disables the resilience around it.
   */
  onMessage: (payload: unknown) => void | Promise<void>;
  url?: string;
  anonKey?: string;
  /** Poll interval (ms) used whenever the realtime channel is not healthy. */
  pollMs?: number;
  enabled?: boolean;
};

/**
 * The shared "live or poll" primitive for the site's realtime surfaces:
 * comments, likes, journal, profile follow counts, DMs, the dashboard.
 *
 * When Supabase realtime is configured it subscribes to a broadcast
 * channel/event and calls `onMessage(payload)` on each push (the server emits a
 * tiny invalidation ping; the client then refetches a cached endpoint - no row
 * streaming, minimal DB load). `onMessage(null)` means "no payload, go refetch".
 *
 * ## Why this is more than a subscribe call
 *
 * The previous version chose realtime purely because the env vars existed, and
 * **never looked at whether the subscription actually succeeded**. `.subscribe()`
 * was called with no status callback at all. So a `CHANNEL_ERROR` (wrong anon
 * key, project paused, connection cap reached, CSP, a phone that slept and
 * dropped the socket) left the surface with no channel, no retry and no poll -
 * permanently silent, on every one of the seven surfaces above. The only way to
 * see new data was to reload the page, which is exactly what was reported.
 *
 * Three things fix that, all of them modelled on what the community chat already
 * does (`ChatClient.tsx`, which had the same bug and was fixed locally there):
 *
 * 1. **The poll is always armed**, and early-returns on every tick while the
 *    channel is healthy - so a working deployment issues *zero* extra requests
 *    and this costs nothing on the Supabase/Vercel bills. The moment the channel
 *    is not SUBSCRIBED, it is what keeps the surface alive.
 * 2. **A failed channel is retried** with exponential backoff (1s → 30s), so a
 *    project that is genuinely over its connection limit is not hammered.
 * 3. **Waking up refetches immediately.** Returning to a hidden tab, regaining
 *    focus, or the network coming back are precisely the moments the data is
 *    stalest and the socket most likely dead - and waiting out a poll interval
 *    there is what makes an app feel like it needs a refresh. Throttled so the
 *    events cannot stack into a request storm.
 */
export function useRealtime({ channel, event, onMessage, url, anonKey, pollMs, enabled = true }: UseRealtimeOpts) {
  const cb = useRef(onMessage);
  // Keep the latest callback in a ref, assigned after commit rather than during
  // render (writing a ref while rendering isn't safe under concurrent
  // rendering). It's only ever read from async realtime/poll callbacks, which
  // run well after this effect has flushed.
  useEffect(() => {
    cb.current = onMessage;
  });

  const u = url ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const k = anonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!enabled) return;
    const mode = realtimeMode(u, k, pollMs);
    if (mode === "off") return;

    let cancelled = false;
    let live = false;
    let retries = 0;
    let lastWake = 0;
    // False until the channel has been up once, so the first subscribe does not
    // trigger a redundant refetch on top of the server-rendered data.
    let reconnected = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let teardown: (() => void) | undefined;

    const visible = () => typeof document === "undefined" || document.visibilityState === "visible";

    // Channel only. Retried on its own; must NOT arm the poll, or every retry
    // would leave another interval behind.
    //
    // `connecting` matters because two things can call this at once - the
    // backoff timer and a wake event - and `getRealtimeClient` is async. Without
    // the guard the second call would build a second channel and overwrite
    // `teardown`, leaking the first subscription for the life of the page.
    let connecting = false;
    async function connect() {
      if (!u || !k || connecting) return;
      connecting = true;
      try {
        await open();
      } finally {
        connecting = false;
      }
    }

    async function open() {
      if (!u || !k) return;
      if (cancelled) return;
      teardown?.(); // never stack subscriptions on a reconnect
      teardown = undefined;

      // Through the shared registry. This hook is used for `user:<id>`,
      // `notifications`, `post:<id>` and more - topics that RealtimeSession,
      // NavActivity and WhatsNewFeed also join. Calling client.channel()
      // directly meant whichever mounted second got an already-subscribed
      // channel and threw, losing its listeners silently.
      const ch = joinSharedChannel(u, k, channel);
      const offMsg = ch.onBroadcast(event, (payload) => cb.current(payload));
      const offStatus = ch.onStatus((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          live = true;
          retries = 0;
          // Broadcast has no replay, so anything sent while the channel was
          // down was missed. Reconcile once on a RE-connect only: on the first
          // subscribe the consumer has just rendered its own server data.
          if (reconnected) void cb.current(null);
          reconnected = true;
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          live = false;
          const delay = Math.min(1000 * 2 ** retries, 30_000);
          retries += 1;
          retryTimer = setTimeout(() => {
            if (!cancelled) void connect();
          }, delay);
        }
      });

      teardown = () => {
        offMsg();
        offStatus();
        ch.release();
        live = false;
      };
    }

    // Retry a FAILED poll on its own short schedule rather than waiting out the
    // whole interval. A dropped connection, a 503 from a busy database, or a
    // phone switching from wifi to mobile data should cost a second, not a
    // cycle - and if the next cycle fails too, the old behaviour left the
    // surface stale until the user reloaded. That is "kabhi kabhi data sync
    // nahi hota", and it is why per-component fixes kept not being enough.
    let pollFailures = 0;
    let pollRetry: ReturnType<typeof setTimeout> | undefined;
    let polling = false;

    const tick = async () => {
      if (!visible()) return;
      if (live) return; // realtime has it covered - costs nothing
      if (polling) return; // never overlap; a slow response must not pile up
      polling = true;
      try {
        await cb.current(null);
        pollFailures = 0;
        clearTimeout(pollRetry);
      } catch {
        pollFailures += 1;
        clearTimeout(pollRetry);
        pollRetry = setTimeout(() => void tick(), Math.min(1000 * 2 ** (pollFailures - 1), 30_000));
      } finally {
        polling = false;
      }
    };
    const pollTimer = setInterval(() => void tick(), pollMs && pollMs > 0 ? pollMs : FALLBACK_POLL_MS);

    // Back from a hidden tab, refocused, or back online: refetch now and, if the
    // channel is down, retry it now instead of waiting out the backoff.
    const wake = () => {
      if (!visible() || live) return;
      const now = Date.now();
      if (now - lastWake < WAKE_MIN_GAP_MS) return;
      lastWake = now;
      // A wake also abandons any long backoff: the user is here now and the
      // network may have changed underneath it.
      clearTimeout(pollRetry);
      pollFailures = 0;
      void tick();
      if (mode === "realtime") {
        clearTimeout(retryTimer);
        retries = 0;
        void connect();
      }
    };

    if (typeof document !== "undefined") document.addEventListener("visibilitychange", wake);
    if (typeof window !== "undefined") {
      window.addEventListener("online", wake);
      window.addEventListener("focus", wake);
    }

    if (mode === "realtime") void connect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      clearTimeout(pollRetry);
      clearInterval(pollTimer);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", wake);
      if (typeof window !== "undefined") {
        window.removeEventListener("online", wake);
        window.removeEventListener("focus", wake);
      }
      teardown?.();
    };
  }, [u, k, channel, event, pollMs, enabled]);
}
