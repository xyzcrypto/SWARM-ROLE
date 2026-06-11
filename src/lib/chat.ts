// Community chat — validation schemas + server-side realtime broadcast.
// Delivery model: Postgres is the source of truth (history), Supabase Realtime
// "broadcast" pushes new/hidden events to subscribed clients instantly. When
// the Supabase env is unset, broadcast is a silent no-op and the client falls
// back to polling — chat still works end-to-end.
import { z } from "zod";
import { env, realtimeEnabled } from "@/lib/env";

export const CHAT_CHANNEL = "community";
export const CHAT_PAGE_SIZE = 50;
export const CHAT_MAX_LENGTH = 500;

export const chatMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Message cannot be empty.")
    .max(CHAT_MAX_LENGTH, `Keep it under ${CHAT_MAX_LENGTH} characters.`),
});

// The author fields that are safe to ship to every client (no email).
export type ChatAuthor = {
  name: string | null;
  username: string | null;
  image: string | null;
  membership: string;
  role: string;
};

export type ChatMessagePayload = {
  id: string;
  body: string;
  createdAt: string; // ISO
  userId: string;
  author: ChatAuthor;
};

type ChatEvent =
  | { event: "new_message"; payload: ChatMessagePayload }
  | { event: "message_hidden"; payload: { id: string } };

/**
 * Push a chat event to the public `community` Realtime channel via Supabase's
 * HTTP broadcast endpoint (server-side, service-role key). Fire-and-forget:
 * a realtime hiccup must never fail the API request — history (DB) is the
 * source of truth and clients reconcile via polling/refresh.
 */
export async function broadcastChatEvent(evt: ChatEvent): Promise<void> {
  if (!realtimeEnabled) return;
  try {
    const res = await fetch(`${env.SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ topic: CHAT_CHANNEL, event: evt.event, payload: evt.payload, private: false }],
      }),
    });
    if (!res.ok) {
      console.error("[chat] broadcast failed", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("[chat] broadcast error", err);
  }
}
