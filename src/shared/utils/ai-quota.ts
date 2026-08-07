// Pure quota-presentation rules, shared by the server route and the client
// widget. Deliberately free of prisma/env imports so a "use client" component
// can import it - `@/lib/ai/limits` pulls in the DB and server-only env and
// would fail the build here.

/**
 * How much of the daily budget to surface, if any.
 *
 * Progressive on purpose. A permanently visible counter teaches members to
 * ration their usage, which works against the point of a free tier. But a cap
 * with no warning is worse - before this, a member only discovered the limit by
 * hitting it mid-task. So the budget stays invisible until it is close enough
 * to matter, then gets louder.
 *
 * Thresholds are absolute rather than a percentage of the limit, so they behave
 * the same for Free (25/day) and Premium (300/day). A percentage would surface
 * the counter to Premium members at 120 remaining, which is pure noise.
 */
export const QUOTA_QUIET_AT = 10;
export const QUOTA_WARN_AT = 3;

export type QuotaLevel = "hidden" | "quiet" | "warn" | "blocked";

export function quotaLevel(remaining: number): QuotaLevel {
  if (!Number.isFinite(remaining)) return "hidden";
  if (remaining <= 0) return "blocked";
  if (remaining <= QUOTA_WARN_AT) return "warn";
  if (remaining <= QUOTA_QUIET_AT) return "quiet";
  return "hidden";
}
