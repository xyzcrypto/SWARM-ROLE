"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { hapticSelect } from "./haptics";
import { playSfx, unlockAudio } from "./sfx";

/** Anything a member presses. */
const PRESSABLE = 'button, a[href], [role="button"], [role="menuitem"], [role="tab"], [role="radio"], [role="slider"], [role="switch"], summary, input[type="range"], input[type="checkbox"]';

/**
 * One listener per chat surface gives EVERY control in it a haptic tick (and,
 * at the "all" sound level, a soft click) - "har chij pe haptic". Delegated on
 * pointer-down in the capture phase, so:
 *
 *  - a control added later (a menu, a sheet, a reaction row) is covered without
 *    remembering to wire it; React events bubble through portals, so portalled
 *    menus and sheets rendered by the surface count too;
 *  - it fires on press, which is when a physical button clicks, not on release;
 *  - a control's own stronger pattern (sent, toggle, error) simply replaces
 *    this one, because a new `vibrate()` cancels the previous.
 *
 * It is also the gesture that unlocks audio, so incoming-message sounds work
 * from the first interaction on.
 */
export function chatPressFeedback(e: ReactPointerEvent<HTMLElement>): void {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  const el = (e.target as Element | null)?.closest?.(PRESSABLE) as (HTMLElement & { disabled?: boolean }) | null;
  unlockAudio();
  if (!el || el.disabled || el.getAttribute("aria-disabled") === "true") return;
  hapticSelect();
  playSfx("tick");
}
