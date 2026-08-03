/**
 * Shared constants for server-backed presence.
 *
 * "Server-backed" because Supabase Realtime presence is the nice path and not a
 * dependable one - when the channel cannot connect, every presence number on
 * the site reads 0 while the site is in use. The chat already had this fallback;
 * the admin dashboard's "Live online" did not, and showed a flat 0 with no
 * retry, no poll and no indication that its only source was gone.
 */

/** A row counts as present if it was touched within this window. */
export const PRESENCE_WINDOW_MS = 60_000;

/**
 * Rooms are just labels on the same table, and the row is keyed by user - so
 * exactly ONE writer per user at a time. `/community` is owned by ChatClient
 * (which needs a 15s beat and the member list); every other page is owned by
 * RealtimeSession at a slower beat. They must not both write, or the row's room
 * would flip back and forth and the chat's count would lose people.
 */
export const ROOM_COMMUNITY = "community";
export const ROOM_SITE = "site";

/** How often a non-chat page re-announces itself while realtime is down. */
export const SITE_BEAT_MS = 45_000;

/** Rows older than this are swept opportunistically on a fraction of reads. */
export const PRESENCE_PRUNE_OLDER_THAN_MS = 30 * 60 * 1000;
export const PRESENCE_PRUNE_CHANCE = 0.02;

/**
 * Does this path own the presence row via the chat client? Kept here so the
 * client and the route agree on one rule rather than two copies of a string.
 */
export function chatOwnsPresence(pathname: string | null | undefined): boolean {
  return typeof pathname === "string" && pathname.startsWith("/community");
}
