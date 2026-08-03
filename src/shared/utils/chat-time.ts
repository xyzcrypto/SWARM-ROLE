/**
 * Clock times and day separators for message lists (community chat and DMs).
 *
 * ## Why both take a `local` flag instead of just formatting
 *
 * These are the one place on the site where a date genuinely means *the
 * reader's* day - "Today" has to follow the reader's midnight, and a message
 * clock has to read in their timezone. So they cannot be pinned to UTC the way
 * `formatDate` and friends are.
 *
 * But the reader's timezone is not knowable while server rendering, and
 * guessing wrong is not free: the server sent "6:06 AM" where an IST browser
 * rendered "11:36 AM", and React treats a text difference as a hard hydration
 * failure (#418), throwing away the server-rendered thread.
 *
 * So `local` is false for the server render AND the hydrating client render -
 * both produce the same UTC-based string, nothing to mismatch - and true from
 * the render right after hydration onwards, via `useHydrated()`. The two only
 * ever disagree for messages within the timezone offset of midnight.
 */

/** "1:36 PM" - in the reader's timezone once hydrated, UTC before that. */
export function clockTime(iso: string, local: boolean): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: local ? undefined : "UTC",
  });
}

/** "Today" / "Yesterday" / "Aug 2, 2026", same timezone rule as clockTime. */
export function dayLabel(iso: string, local: boolean, now: number = Date.now()): string {
  const d = new Date(iso);
  const zone = local ? undefined : "UTC";
  // en-CA gives YYYY-MM-DD, which compares as a plain string - no date maths,
  // and no chance of two Date objects in different zones agreeing by accident.
  const dayKey = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: zone });
  if (dayKey(d) === dayKey(new Date(now))) return "Today";
  if (dayKey(d) === dayKey(new Date(now - 864e5))) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: zone });
}

/**
 * Has the other side read this message?
 *
 * The entire read-receipt calculation, and it needs no per-message column: a
 * conversation records when each participant last opened it, so anything sent
 * before that has been seen. `readAt` is null until they have ever opened the
 * thread, which reads as "not yet".
 */
/**
 * Keep the later of two read timestamps.
 *
 * Receipts arrive from two directions - the realtime `dm_read` ping and the
 * thread refetch - and they can land out of order. A tick that goes back to
 * unread because a slower response carried older data looks like a bug even
 * though nothing is wrong, so a receipt only ever moves forward.
 */
export function newestRead(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(b).getTime() > new Date(a).getTime() ? b : a;
}

export function isReadBy(messageCreatedAt: string, otherReadAt: string | null | undefined): boolean {
  if (!otherReadAt) return false;
  const read = new Date(otherReadAt).getTime();
  const sent = new Date(messageCreatedAt).getTime();
  if (!Number.isFinite(read) || !Number.isFinite(sent)) return false;
  return read >= sent;
}
