"use client";

import { useCallback, useEffect, type RefObject } from "react";

/**
 * Grow a textarea with its content, up to `max`, then scroll inside it.
 *
 * Extracted after the SAME bug shipped twice: Community Chat's and DM's
 * composers were both `rows={1}` + `resize-none` with a `max-h-*` that nothing
 * ever reached, because nothing adjusted the height - a long message scrolled
 * inside one 44px line. Fixed in the room first (PR #362), then found again
 * here. One hook so the next composer inherits the fix instead of the bug.
 *
 * Three things are load-bearing, and each was learned the hard way:
 *
 * 1. **Release the height before measuring.** The `scrollHeight` of an element
 *    with a fixed height IS that height, so measuring without `height = auto`
 *    reads back what you set and the box never grows a second time.
 * 2. **The placeholder is a measurement input.** An empty textarea's
 *    scrollHeight includes its placeholder. A browser probe caught the room's
 *    empty composer at 76px on a phone: measured against the server
 *    snapshot's longer desktop placeholder, never again until the user typed.
 *    Pass anything that changes the placeholder in `deps`.
 * 3. **Width changes re-wrap text.** Rotation and resize change the height the
 *    text needs, so a ResizeObserver re-measures - on WIDTH only, because
 *    setting the height changes the size too and reacting to that would loop.
 */
export function useAutoGrow(
  ref: RefObject<HTMLTextAreaElement | null>,
  max: number,
  deps: readonly unknown[]
) {
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // ⚠️ Empty means ONE line, full stop. `scrollHeight` of an empty textarea
    // includes its placeholder, so a placeholder that wraps on a narrow phone
    // grew the empty composer to two lines and it stopped lining up with the
    // buttons beside it - the room's composer in the owner's screenshot. The
    // placeholder is a hint, not content; it does not get to size the box.
    // (Point 2 above still stands for a NON-empty box.)
    if (!el.value) {
      el.style.height = "";
      el.style.overflowY = "hidden";
      return;
    }
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [ref, max]);

  useEffect(() => {
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` are the caller's measurement inputs
  }, [measure, ...deps]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== lastWidth) {
        lastWidth = el.clientWidth;
        measure();
      }
    });
    ro.observe(el);
    void document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [ref, measure]);

  return measure;
}
