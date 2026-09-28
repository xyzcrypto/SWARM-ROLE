"use client";

import { useEffect } from "react";
import { pressFeedback } from "@shared/utils/chat-feedback";

/**
 * Haptics across the ENTIRE website: one pointer-down listener on the
 * document, capture phase, passive - so every button, link, tab, menu item,
 * switch and slider on every page gives the member's chosen haptic tick (and
 * sound, at "Everything"). Renders nothing; adds no DOM; cannot affect
 * hydration. Honours Customize → Haptics (Off / Standard / Strong).
 */
export function GlobalPressFeedback() {
  useEffect(() => {
    const on = (e: PointerEvent) => pressFeedback(e);
    document.addEventListener("pointerdown", on, { capture: true, passive: true });
    return () => document.removeEventListener("pointerdown", on, { capture: true });
  }, []);
  return null;
}
