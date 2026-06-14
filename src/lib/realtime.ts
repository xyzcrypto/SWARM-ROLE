// Generic server-side Supabase Realtime "broadcast" helper (pub/sub). Used by
// chat, membership updates, and the admin members feed. Fire-and-forget: a
// realtime hiccup must never fail an API request - the DB stays the source of
// truth. No-op when the Supabase env is unset (clients fall back to polling).
import { env, realtimeEnabled } from "@/lib/env";

// Channel / topic names shared by server (broadcast) and clients (subscribe).
export const CH_SITE = "site-visitors"; // global presence → live-online count
export const CH_MEMBERS = "members"; // admin member-list live updates
export const userChannel = (userId: string) => `user:${userId}`; // per-user events

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
