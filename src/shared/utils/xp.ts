// Basic engagement XP - the foundation for a future gamified system. Every
// action is worth a flat 1 XP, capped once per user per day (see XpEvent's
// unique constraint). Kept deliberately simple: no levels, streaks, or badges
// yet - those layer on top of this once the gamified system is built.

export type XpAction = "checkin" | "research_view" | "news_read" | "tool_use" | "profile_update";

export const XP_ACTIONS: XpAction[] = ["checkin", "research_view", "news_read", "tool_use", "profile_update"];

export const XP_VALUES: Record<XpAction, number> = {
  checkin: 1,
  research_view: 1,
  news_read: 1,
  tool_use: 1,
  profile_update: 1,
};

export const XP_LABELS: Record<XpAction, string> = {
  checkin: "Daily check-in",
  research_view: "Read a research post",
  news_read: "Read a news story",
  tool_use: "Used a trading tool",
  profile_update: "Updated your profile",
};

export function isXpAction(value: unknown): value is XpAction {
  return typeof value === "string" && (XP_ACTIONS as string[]).includes(value);
}

/** UTC day key (YYYY-MM-DD) - stable regardless of the caller's local timezone. */
export function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
