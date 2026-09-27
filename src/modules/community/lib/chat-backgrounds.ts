/**
 * Chat background presets.
 *
 * ## Why these are CSS, not images
 *
 * ⚠️ Every preset below is a gradient or a repeating-linear-gradient written
 * inline. There is no asset, no fetch, no decode, and nothing to add to the
 * page weight - which is the brief's constraint ("lightweight assets, no large
 * video backgrounds, no expensive canvas effects") satisfied by construction
 * rather than by being careful. A chat background is behind scrolling content;
 * anything that repaints is the wrong answer.
 *
 * ## Why they are this quiet
 *
 * The readability of the messages is the product. Each preset is a low-contrast
 * wash that sits UNDER the bubbles and never competes with them: the grid is at
 * 2-3% alpha, the tinted ones are a single large radial at under 10%. A
 * background that is interesting to look at is a background you cannot read a
 * conversation on, and that is the failure mode of every chat wallpaper feature.
 *
 * ## Theme
 *
 * Each preset carries BOTH a dark and a light value. The room is used in both
 * themes, and a wash tuned for near-black is either invisible or filthy on a
 * light page - which is the same mistake the app's hover tints made.
 */
export type ChatBackgroundId =
  | "default"
  | "graphite"
  | "grid"
  | "gold"
  | "mint"
  | "midnight"
  | "aurora";

export type ChatBackground = {
  id: ChatBackgroundId;
  label: string;
  /** What paints in dark mode. Empty string = the room's own surface. */
  dark: string;
  /** What paints in light mode. */
  light: string;
};

export const CHAT_BACKGROUNDS: readonly ChatBackground[] = [
  {
    id: "default",
    label: "Default",
    dark: "",
    light: "",
  },
  {
    id: "graphite",
    label: "Soft graphite",
    dark: "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0) 60%)",
    light: "linear-gradient(180deg, rgba(16,18,27,0.05) 0%, rgba(16,18,27,0) 60%)",
  },
  {
    id: "grid",
    label: "Subtle grid",
    // 32px grid. Two repeating gradients rather than an SVG: no request, and it
    // scales without resampling.
    dark:
      "repeating-linear-gradient(0deg, rgba(255,255,255,0.028) 0 1px, transparent 1px 32px)," +
      "repeating-linear-gradient(90deg, rgba(255,255,255,0.028) 0 1px, transparent 1px 32px)",
    light:
      "repeating-linear-gradient(0deg, rgba(16,18,27,0.045) 0 1px, transparent 1px 32px)," +
      "repeating-linear-gradient(90deg, rgba(16,18,27,0.045) 0 1px, transparent 1px 32px)",
  },
  {
    id: "gold",
    label: "Minimal gold",
    dark: "radial-gradient(120% 70% at 50% 0%, rgba(226,167,47,0.10) 0%, rgba(226,167,47,0) 62%)",
    light: "radial-gradient(120% 70% at 50% 0%, rgba(226,167,47,0.16) 0%, rgba(226,167,47,0) 62%)",
  },
  {
    id: "mint",
    label: "Minimal mint",
    dark: "radial-gradient(120% 70% at 50% 0%, rgba(11,187,124,0.10) 0%, rgba(11,187,124,0) 62%)",
    light: "radial-gradient(120% 70% at 50% 0%, rgba(11,187,124,0.14) 0%, rgba(11,187,124,0) 62%)",
  },
  {
    id: "midnight",
    label: "Midnight",
    // ⚠️ Was 0.65/0.20 - four times heavier than every other preset, which
    // would have visibly darkened the room and dragged the message text with
    // it. Caught by the readability assertion in `chat-premium-ux.test.ts`,
    // which caps every preset at 0.2: the whole point of that check is that a
    // wallpaper must never win against the conversation on top of it.
    dark: "linear-gradient(180deg, rgba(10,12,28,0.16) 0%, rgba(5,5,7,0.06) 70%)",
    light: "linear-gradient(180deg, rgba(41,47,84,0.10) 0%, rgba(41,47,84,0) 70%)",
  },
  {
    id: "aurora",
    label: "Aurora",
    // Two offset radials. Static - no animation, deliberately: this sits behind
    // a scrolling list, and an animated background is a repaint on every frame
    // of every scroll.
    dark:
      "radial-gradient(90% 55% at 12% 0%, rgba(11,187,124,0.10) 0%, rgba(11,187,124,0) 55%)," +
      "radial-gradient(80% 50% at 88% 12%, rgba(226,167,47,0.09) 0%, rgba(226,167,47,0) 55%)",
    light:
      "radial-gradient(90% 55% at 12% 0%, rgba(11,187,124,0.14) 0%, rgba(11,187,124,0) 55%)," +
      "radial-gradient(80% 50% at 88% 12%, rgba(226,167,47,0.15) 0%, rgba(226,167,47,0) 55%)",
  },
] as const;

/** Where the choice is remembered. */
export const CHAT_BG_KEY = "xyz.chat.bg";

export function isChatBackgroundId(v: unknown): v is ChatBackgroundId {
  return typeof v === "string" && CHAT_BACKGROUNDS.some((b) => b.id === v);
}

export function chatBackgroundById(id: ChatBackgroundId): ChatBackground {
  return CHAT_BACKGROUNDS.find((b) => b.id === id) ?? CHAT_BACKGROUNDS[0]!;
}
