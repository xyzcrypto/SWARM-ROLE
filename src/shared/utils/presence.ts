/**
 * Shared constants for server-backed presence.
 *
 * "Server-backed" because Supabase Realtime presence is the nice path and not a
 * dependable one - when the channel cannot connect, every presence number on
 * the site reads 0 while the site is in use. The chat already had this fallback;
 * the admin dashboard's "Live online" did not, and showed a flat 0 with no
 * retry, no poll and no indication that its only source was gone.
 */

/**
 * A row counts as present if it was touched within this window.
 *
 * Only the SITE-wide count uses this; the chat room keeps its own tighter 60s
 * window (`api/chat/presence`), because there the roster is on screen and a
 * stale name is obvious. Widened to 3 minutes so the site heartbeat below can
 * be slow: every beat is a database write from every open page of every
 * signed-in user, and that pressure is a plausible contributor to the
 * intermittent connection-pool exhaustion this codebase is prone to.
 */
export const PRESENCE_WINDOW_MS = 180_000;

/**
 * Rooms are just labels on the same table, and the row is keyed by user - so
 * exactly ONE writer per user at a time. `/community` is owned by ChatClient
 * (which needs a 15s beat and the member list); every other page is owned by
 * RealtimeSession at a slower beat. They must not both write, or the row's room
 * would flip back and forth and the chat's count would lose people.
 */
export const ROOM_COMMUNITY = "community";
export const ROOM_SITE = "site";

/**
 * How often a non-chat page re-announces itself while realtime is down.
 *
 * 120s, not 45s. This feeds ONE admin dashboard tile, and it costs a database
 * write from every open page of every signed-in user. A number that is at most
 * two minutes stale is entirely adequate for that tile; three times the write
 * pressure to sharpen it is not a trade worth making on this plan.
 */
export const SITE_BEAT_MS = 120_000;

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
