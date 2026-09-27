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

/**
 * ⚠️ Formatters are built once and reused, not per call.
 *
 * `toLocaleTimeString(locale, opts)` constructs a fresh `Intl.DateTimeFormat`
 * on EVERY call, and constructing one is the expensive part. These run once
 * per message per render, so a 150-message DM paid for ~600 formatter
 * constructions per render: measured 58ms of a 100ms keystroke on desktop.
 * The strings are identical (pinned by chat-time-format.test.ts, in several
 * timezones).
 *
 * The reader's zone is applied by SHIFTING the instant by its own UTC offset
 * and formatting that as UTC - not by caching a local-zone formatter. A cached
 * one would freeze whatever zone was current when it was built, and the zone
 * can change under a live page (a laptop crossing a border, a DST rule, a test
 * that sets TZ). `getTimezoneOffset()` is cheap and always current, and for
 * fields with no zone name in them (hour, minute, day, month, year) the two
 * are the same thing.
 */
const CLOCK = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
const DAY_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" });
const DAY_LONG = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** The same wall-clock reading, expressed as a UTC instant. */
const inZone = (d: Date, local: boolean) => (local ? new Date(d.getTime() - d.getTimezoneOffset() * 60_000) : d);

// ⚠️ `toLocale*String` returns "Invalid Date" for a bad date; `format` THROWS.
const fmt = (f: Intl.DateTimeFormat, d: Date, local: boolean) =>
  Number.isNaN(d.getTime()) ? "Invalid Date" : f.format(inZone(d, local));

/** "1:36 PM" - in the reader's timezone once hydrated, UTC before that. */
export function clockTime(iso: string, local: boolean): string {
  return fmt(CLOCK, new Date(iso), local);
}

/** "Today" / "Yesterday" / "Aug 2, 2026", same timezone rule as clockTime. */
export function dayLabel(iso: string, local: boolean, now: number = Date.now()): string {
  const d = new Date(iso);
  // en-CA gives YYYY-MM-DD, which compares as a plain string - no date maths,
  // and no chance of two Date objects in different zones agreeing by accident.
  const dayKey = (x: Date) => fmt(DAY_KEY, x, local);
  const k = dayKey(d);
  if (k === dayKey(new Date(now))) return "Today";
  if (k === dayKey(new Date(now - 864e5))) return "Yesterday";
  return fmt(DAY_LONG, d, local);
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
