/**
 * When the hero's research band is allowed to claim something is new.
 *
 * This exists because the first version did not ask. It badged whatever the
 * newest published post was as `NEW` with a blinking dot, and on a site that
 * had not published for a month that meant a 29-day-old report announcing
 * itself as just-live. A visitor who clicks that finds nothing new, which
 * costs more trust than the badge ever buys.
 *
 * So the badge states which of two true things it means. Both are honest; the
 * second simply does not overclaim.
 */

/** Inside this many days, "NEW" is a fair claim. */
export const FRESH_DAYS = 7;

export type FeedBadge = "new" | "latest";

/** Whole days between `then` and `now`, floored, never negative. */
export function daysSince(then: Date, now: number): number {
  return Math.max(0, Math.floor((now - then.getTime()) / 86_400_000));
}

/**
 * `new` only while the post is genuinely recent; `latest` after that. With no
 * date at all, claim the weaker of the two.
 */
export function feedBadge(ageDays: number | null): FeedBadge {
  return ageDays !== null && ageDays <= FRESH_DAYS ? "new" : "latest";
}

/**
 * The live dot is a claim of its own - something is happening right now - so it
 * blinks only when the badge says `new`.
 */
export function showLiveDot(ageDays: number | null): boolean {
  return feedBadge(ageDays) === "new";
}
