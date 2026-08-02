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
export { CH_SITE, CH_MEMBERS, CH_NOTIFY, userChannel } from "@/lib/realtime-channels";

export async function broadcastEvent(topic: string, event: string, payload: unknown): Promise<void> {
  if (!realtimeEnabled) return;
  try {
    const res = await fetch(`${env.SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: [{ topic, event, payload, private: false }] }),
    });
    if (!res.ok) {
      console.error("[realtime] broadcast failed", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("[realtime] broadcast error", err);
  }
}
