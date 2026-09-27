/**
 * Chat background presets.
 *
 * ## Why these are CSS, not images
 *
 * ⚠️ Every preset below is a gradient or a repeating gradient written inline.
 * There is no asset, no fetch, no decode, and nothing to add to the page weight
 * - the brief's constraint ("lightweight assets, no large video backgrounds, no
 * expensive canvas effects") satisfied by construction rather than by care. A
 * chat background sits behind scrolling content; anything that repaints is the
 * wrong answer.
 *
 * ## Why they are this quiet
 *
 * In this room other people's messages have no bubble - their text sits
 * directly on the background. So readability of the conversation IS the
 * product, and every preset is a low-contrast wash or a hairline pattern that
 * sits under the text without competing with it. `chat-premium-ux.test.ts`
 * caps every alpha at 0.2, and has already caught one preset at 0.65.
 *
 * A member's own photo is the exception, and it is handled separately with a
 * COMPUTED scrim - see `chat-wallpaper.ts`.
 *
 * ## Two families
 *
 * - **Colour** - soft washes in the brand palette (gold, mint, ink).
 * - **Pattern** - hairline geometry: grid, dots, diagonals, crosshatch, and an
 *   isometric lattice, which is the one that reads as "blockchain" without a
 *   single literal chain icon.
 *
 * ## Theme
 *
 * Each preset carries BOTH a dark and a light value. A wash tuned for
 * near-black is either invisible or filthy on a light page - the same mistake
 * the app's white hover tints made.
 */
export type ChatBackgroundId =
  | "default"
  | "graphite"
  | "gold"
  | "mint"
  | "midnight"
  | "aurora"
  | "grid"
  | "dots"
  | "diagonal"
  | "crosshatch"
  | "isometric";

export type ChatBackgroundCategory = "colour" | "pattern";

export type ChatBackground = {
  id: ChatBackgroundId;
  label: string;
  category: ChatBackgroundCategory;
  /** What paints in dark mode. Empty string = the room's own surface. */
  dark: string;
  /** What paints in light mode. */
  light: string;
  /**
   * `background-size`, for patterns whose tile is not the whole element
   * (dots). Omitted for washes and for repeating gradients, which tile
   * themselves.
   */
  size?: string;
};

// Hairline helpers, so every pattern uses the same stroke and the families
// read as one set rather than five unrelated textures.
const W = (a: number) => `rgba(255,255,255,${a})`;
const K = (a: number) => `rgba(16,18,27,${a})`;
const lines = (deg: number, c: string, gap: number) =>
  `repeating-linear-gradient(${deg}deg, ${c} 0 1px, transparent 1px ${gap}px)`;

export const CHAT_BACKGROUNDS: readonly ChatBackground[] = [
  // ── Colour ────────────────────────────────────────────────────────────
  { id: "default", label: "Default", category: "colour", dark: "", light: "" },
  {
    id: "graphite",
    label: "Soft graphite",
    category: "colour",
    dark: `linear-gradient(180deg, ${W(0.035)} 0%, ${W(0)} 60%)`,
    light: `linear-gradient(180deg, ${K(0.05)} 0%, ${K(0)} 60%)`,
  },
  {
    id: "gold",
    label: "Minimal gold",
    category: "colour",
    dark: "radial-gradient(120% 70% at 50% 0%, rgba(226,167,47,0.10) 0%, rgba(226,167,47,0) 62%)",
    light: "radial-gradient(120% 70% at 50% 0%, rgba(226,167,47,0.16) 0%, rgba(226,167,47,0) 62%)",
  },
  {
    id: "mint",
    label: "Minimal mint",
    category: "colour",
    dark: "radial-gradient(120% 70% at 50% 0%, rgba(11,187,124,0.10) 0%, rgba(11,187,124,0) 62%)",
    light: "radial-gradient(120% 70% at 50% 0%, rgba(11,187,124,0.14) 0%, rgba(11,187,124,0) 62%)",
  },
  {
    id: "midnight",
    label: "Midnight",
    category: "colour",
    // ⚠️ Was 0.65/0.20 - four times heavier than every other preset, enough to
    // darken the room and drag the message text with it. Caught by the
    // readability cap in `chat-premium-ux.test.ts`.
    dark: "linear-gradient(180deg, rgba(10,12,28,0.16) 0%, rgba(5,5,7,0.06) 70%)",
    light: "linear-gradient(180deg, rgba(41,47,84,0.10) 0%, rgba(41,47,84,0) 70%)",
  },
  {
    id: "aurora",
    label: "Aurora",
    category: "colour",
    // Two offset radials. Static - no animation, deliberately.
    dark:
      "radial-gradient(90% 55% at 12% 0%, rgba(11,187,124,0.10) 0%, rgba(11,187,124,0) 55%)," +
      "radial-gradient(80% 50% at 88% 12%, rgba(226,167,47,0.09) 0%, rgba(226,167,47,0) 55%)",
    light:
      "radial-gradient(90% 55% at 12% 0%, rgba(11,187,124,0.14) 0%, rgba(11,187,124,0) 55%)," +
      "radial-gradient(80% 50% at 88% 12%, rgba(226,167,47,0.15) 0%, rgba(226,167,47,0) 55%)",
  },

  // ── Pattern ───────────────────────────────────────────────────────────
  {
    id: "grid",
    label: "Grid",
    category: "pattern",
    dark: `${lines(0, W(0.028), 32)}, ${lines(90, W(0.028), 32)}`,
    light: `${lines(0, K(0.045), 32)}, ${lines(90, K(0.045), 32)}`,
  },
  {
    id: "dots",
    label: "Dots",
    category: "pattern",
    dark: `radial-gradient(${W(0.075)} 1px, transparent 1.6px)`,
    light: `radial-gradient(${K(0.11)} 1px, transparent 1.6px)`,
    size: "20px 20px",
  },
  {
    id: "diagonal",
    label: "Diagonal",
    category: "pattern",
    dark: lines(135, W(0.03), 16),
    light: lines(135, K(0.05), 16),
  },
  {
    id: "crosshatch",
    label: "Crosshatch",
    category: "pattern",
    dark: `${lines(45, W(0.024), 22)}, ${lines(-45, W(0.024), 22)}`,
    light: `${lines(45, K(0.04), 22)}, ${lines(-45, K(0.04), 22)}`,
  },
  {
    id: "isometric",
    label: "Isometric",
    category: "pattern",
    // Three line families 60° apart at equal spacing tile into a regular
    // triangular lattice. A faint gold glow at the top makes it the one
    // signature pattern rather than just another texture.
    dark:
      "radial-gradient(110% 60% at 50% 0%, rgba(226,167,47,0.07) 0%, rgba(226,167,47,0) 60%)," +
      `${lines(0, W(0.022), 26)}, ${lines(60, W(0.022), 26)}, ${lines(120, W(0.022), 26)}`,
    light:
      "radial-gradient(110% 60% at 50% 0%, rgba(226,167,47,0.12) 0%, rgba(226,167,47,0) 60%)," +
      `${lines(0, K(0.035), 26)}, ${lines(60, K(0.035), 26)}, ${lines(120, K(0.035), 26)}`,
  },
] as const;

/** Where the choice is remembered. A preset id, or "photo". */
export const CHAT_BG_KEY = "xyz.chat.bg";

/** The member's photo settings (dim, blur). The photo itself is in IndexedDB. */
export const CHAT_BG_PHOTO_KEY = "xyz.chat.bg.photo";

export function isChatBackgroundId(v: unknown): v is ChatBackgroundId {
  return typeof v === "string" && CHAT_BACKGROUNDS.some((b) => b.id === v);
}

export function chatBackgroundById(id: ChatBackgroundId): ChatBackground {
  return CHAT_BACKGROUNDS.find((b) => b.id === id) ?? CHAT_BACKGROUNDS[0]!;
}

export function presetsIn(category: ChatBackgroundCategory): ChatBackground[] {
  return CHAT_BACKGROUNDS.filter((b) => b.category === category);
}
