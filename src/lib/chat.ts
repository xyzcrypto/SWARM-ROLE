// Community chat - validation schemas + server-side realtime broadcast.
// Delivery model: Postgres is the source of truth (history), Supabase Realtime
// "broadcast" pushes new/hidden/reaction events to subscribed clients instantly.
// When the Supabase env is unset, broadcast is a silent no-op and the client
// falls back to polling - chat still works end-to-end.
import { z } from "zod";
import { broadcastEvent } from "@/lib/realtime";

export const CHAT_CHANNEL = "community";
export const CHAT_PAGE_SIZE = 50;
export const CHAT_MAX_LENGTH = 500;

// Reaction emoji allowlist (kept small + curated; rendered as text, no lib).
export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🔥", "🚀", "🎉", "👀", "💯"] as const;

// Realtime sub-events sent over the broadcast channel.
export const TYPING_EVENT = "typing";
export const PRESENCE_KEY = "online";

export const chatMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Message cannot be empty.")
    .max(CHAT_MAX_LENGTH, `Keep it under ${CHAT_MAX_LENGTH} characters.`),
  replyToId: z
    .string()
    .regex(/^c[a-z0-9]{20,}$/i, "Invalid reply target.")
    .optional()
    .nullable(),
});

export const reactionSchema = z.object({
  emoji: z.enum(REACTION_EMOJIS),
});

// The author fields that are safe to ship to every client (no email).
export type ChatAuthor = {
  name: string | null;
  username: string | null;
  image: string | null;
  membership: string;
  role: string;
};

export type ChatReactionSummary = {
  emoji: string;
  count: number;
  userIds: string[]; // clients derive "mine" = includes(myId)
};

export type ChatReplyRef = {
  id: string;
  body: string;
  authorName: string;
};

export type ChatMessagePayload = {
  id: string;
  body: string;
  createdAt: string; // ISO
  editedAt: string | null; // ISO, set when the author edits
  userId: string;
  author: ChatAuthor;
  replyTo: ChatReplyRef | null;
  reactions: ChatReactionSummary[];
};

type ChatEvent =
  | { event: "new_message"; payload: ChatMessagePayload }
  | { event: "message_hidden"; payload: { id: string } }
  | { event: "message_edited"; payload: { id: string; body: string; editedAt: string } }
  | { event: "reaction"; payload: { messageId: string; emoji: string; userId: string; op: "add" | "remove" } };

/**
 * Push a chat event to the public `community` Realtime channel via Supabase's
 * HTTP broadcast endpoint (server-side, service-role key). Fire-and-forget:
 * a realtime hiccup must never fail the API request - history (DB) is the
 * source of truth and clients reconcile via polling/refresh.
 */
export async function broadcastChatEvent(evt: ChatEvent): Promise<void> {
  await broadcastEvent(CHAT_CHANNEL, evt.event, evt.payload);
}

// Shared Prisma selection for a chat message + everything the UI needs.
export const CHAT_MESSAGE_SELECT = {
  id: true,
  body: true,
  createdAt: true,
  editedAt: true,
  userId: true,
  user: { select: { name: true, username: true, image: true, membership: true, role: true } },
  replyTo: { select: { id: true, body: true, user: { select: { name: true, username: true } } } },
  reactions: { select: { emoji: true, userId: true } },
} as const;

// Map a Prisma row (with CHAT_MESSAGE_SELECT) → wire payload.
export function toChatPayload(m: {
  id: string;
  body: string;
  createdAt: Date;
  editedAt?: Date | null;
  userId: string;
  user: ChatAuthor;
  replyTo: { id: string; body: string; user: { name: string | null; username: string | null } } | null;
  reactions: { emoji: string; userId: string }[];
}): ChatMessagePayload {
  const grouped = new Map<string, string[]>();
  for (const r of m.reactions) {
    const arr = grouped.get(r.emoji) ?? [];
    arr.push(r.userId);
    grouped.set(r.emoji, arr);
  }
  // Preserve the allowlist order for a stable UI.
  const reactions: ChatReactionSummary[] = REACTION_EMOJIS.filter((e) => grouped.has(e)).map(
    (emoji) => ({ emoji, count: grouped.get(emoji)!.length, userIds: grouped.get(emoji)! })
  );
  return {
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    editedAt: m.editedAt ? m.editedAt.toISOString() : null,
    userId: m.userId,
    author: m.user,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          body: m.replyTo.body,
          authorName: m.replyTo.user.name ?? (m.replyTo.user.username ? `@${m.replyTo.user.username}` : "Member"),
        }
      : null,
    reactions,
  };
}
