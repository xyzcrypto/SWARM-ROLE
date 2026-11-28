// Generic server-side Supabase Realtime "broadcast" helper (pub/sub). Used by
// chat, membership updates, and the admin members feed. Fire-and-forget: a
// realtime hiccup must never fail an API request - the DB stays the source of
// truth. No-op when the Supabase env is unset (clients fall back to polling).
import { env, realtimeEnabled } from "@/lib/env";

// Channel names are re-exported so the ~20 server call sites that do
// `import { broadcastEvent, userChannel } from "@/lib/realtime"` keep working.
// They are DEFINED in `realtime-channels.ts` because this module imports
// `@/lib/env` (now `server-only`) and therefore cannot be reached from a
// `"use client"` component. Client components must import from
// `@/lib/realtime-channels` directly — see the note in that file.
export { CH_SITE, CH_MEMBERS, CH_NOTIFY, CH_POINTS, userChannel } from "@/lib/realtime-channels";

// Warn once per process rather than on every call - this fires from ~20 sites.
let warnedDisabled = false;

export async function broadcastEvent(topic: string, event: string, payload: unknown): Promise<void> {
  if (!realtimeEnabled) {
    // This used to be a bare `return`. Every live push on the site - the DM
    // badge, the chat message fan-out, the notification bell ping - goes
    // through here, so an unset SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY turned
    // all of them off *silently*, with nothing anywhere saying so. The symptom
    // is "notifications don't arrive", which reads as a client bug and sends
    // you looking in entirely the wrong place.
    //
    // Note these are the SERVER credentials, and they are NOT the same as the
    // NEXT_PUBLIC_ pair the browser uses to subscribe. Either half can be
    // configured without the other, which is exactly how you end up with a chat
    // that connects but never receives anything, or vice versa.
    if (!warnedDisabled) {
      warnedDisabled = true;
      console.error(
        "[realtime] DISABLED: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY are unset, so " +
          "broadcastEvent() is a no-op. DM notifications, live chat delivery and the " +
          "notification bell will not push - clients fall back to polling. Note this is the " +
          "same credential pair as image uploads (storageEnabled), so if uploads return 501 " +
          "in production, this is why realtime is dead too."
      );
    }
    return;
  }
  try {
    const res = await fetch(`${env.SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: [{ topic, event, payload, private: false }] }),
      // ⚠️ Bounded. ~26 request paths `await` this (sending a DM, editing,
      // reacting, polls, pins...). A broadcast is a nicety on top of a write
      // that already succeeded, but with no timeout a stalled Realtime API
      // held each of those requests open until the function's limit: the
      // member saw "sending..." for minutes over a message that was saved.
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) {
      console.error("[realtime] broadcast failed", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("[realtime] broadcast error", err);
  }
}
