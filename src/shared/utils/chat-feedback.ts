"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { hapticSelect } from "./haptics";
import { playSfx, unlockAudio } from "./sfx";

/** Anything a member presses. */
const PRESSABLE = 'button, a[href], [role="button"], [role="menuitem"], [role="tab"], [role="radio"], [role="slider"], [role="switch"], [role="option"], summary, label, select, input[type="range"], input[type="checkbox"], input[type="radio"]';

type Marked = Event & { __xyzPress?: boolean };

/**
 * Press feedback for one native pointer-down: a haptic tick (and, at the
 * "Everything" sound level, a soft click) on any control. Also the gesture
 * that unlocks audio, so incoming-message sounds work from the first tap.
 *
 * Each event is handled ONCE: the site-wide listener (GlobalPressFeedback,
 * on `document`, capture phase) runs first and marks the event, so the
 * older per-surface listeners below it see the mark and step aside - no
 * double buzz, no double click.
 */
export function pressFeedback(ev: PointerEvent): void {
  const e = ev as Marked;
  if (e.__xyzPress) return;
  e.__xyzPress = true;
  if (ev.pointerType === "mouse" && ev.button !== 0) return;
  unlockAudio();
  const el = (ev.target as Element | null)?.closest?.(PRESSABLE) as (HTMLElement & { disabled?: boolean }) | null;
  if (!el || el.disabled || el.getAttribute("aria-disabled") === "true") return;
  hapticSelect();
  playSfx("tick");
}

/** React-handler form, for a surface's `onPointerDownCapture`. */
export function chatPressFeedback(e: ReactPointerEvent<HTMLElement>): void {
  pressFeedback(e.nativeEvent);
}
