// Where to put a pop-up menu so it is actually on screen.
//
// ## The bug this exists for
//
// The DM message menu was `absolute bottom-full` on the message row: pinned
// entirely above the bubble, which is the right *design* - it must not cover the
// message you are about to delete. But an absolutely-positioned box is clipped by
// the nearest scrolling ancestor, and the message list is `overflow-y-auto`. So
// on a phone, opening the menu on any message in the upper part of the thread cut
// the menu off at the top of the list. **Reply is the first item**, so it was the
// first thing to disappear - the menu looked broken or empty, and the feature
// read as missing on mobile while working fine on a tall desktop window.
//
// `position: fixed` escapes the scroll container, but not a `transform` /
// `filter` / `backdrop-filter` ancestor, which re-establishes the containing
// block (the panel uses `.glass`). So the menu is portalled to `document.body`
// and positioned from the trigger's viewport rect - and that means someone has to
// do the arithmetic. This is that arithmetic, kept pure so it can be tested at
// real phone sizes instead of eyeballed.

export type TriggerRect = { top: number; bottom: number; left: number; right: number };

export type MenuBox = {
  /** Distance from the viewport top, when the menu opens downward. */
  top?: number;
  /** Distance from the viewport bottom, when the menu opens upward. */
  bottom?: number;
  left: number;
  /** Hard cap so a menu taller than the room available scrolls instead of overflowing. */
  maxHeight: number;
  placement: "up" | "down";
};

export type PlaceOpts = {
  width: number;
  /** "right" pins the menu's right edge to the trigger's right edge. */
  align: "left" | "right";
  /** Roughly how tall the menu wants to be; only decides which side to open on. */
  preferredHeight?: number;
  /** Space between the trigger and the menu. */
  gap?: number;
  /** Space kept clear at every viewport edge. */
  margin?: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * Viewport coordinates for a `position: fixed` menu anchored to `trigger`.
 *
 * Opens upward when there is room, because covering the message you are acting on
 * is what the original design was avoiding. Falls to whichever side has more room
 * when neither fits, and always returns a `maxHeight` that fits on screen - so the
 * result is never "off the top", only ever "scrollable".
 */
export function placeMenu(trigger: TriggerRect, vw: number, vh: number, opts: PlaceOpts): MenuBox {
  const { width, align } = opts;
  const preferred = opts.preferredHeight ?? 260;
  const gap = opts.gap ?? 6;
  const margin = opts.margin ?? 8;

  const spaceAbove = Math.max(0, trigger.top - gap - margin);
  const spaceBelow = Math.max(0, vh - trigger.bottom - gap - margin);

  let placement: "up" | "down";
  if (spaceAbove >= preferred) placement = "up";
  else if (spaceBelow >= preferred) placement = "down";
  else placement = spaceAbove >= spaceBelow ? "up" : "down";

  const maxHeight = Math.max(0, placement === "up" ? spaceAbove : spaceBelow);

  // A viewport narrower than the menu has no valid clamp range, so pin it to the
  // left margin rather than letting clamp() invert and push it off-screen.
  const raw = align === "right" ? trigger.right - width : trigger.left;
  const left = vw - 2 * margin < width ? margin : clamp(raw, margin, vw - width - margin);

  return placement === "up"
    ? { bottom: vh - trigger.top + gap, left, maxHeight, placement }
    : { top: trigger.bottom + gap, left, maxHeight, placement };
}
