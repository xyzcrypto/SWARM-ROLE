"use client";

import { useEffect } from "react";

/**
 * Pause CSS animations in parts of the page that are not on screen.
 *
 * ## Why
 *
 * Measured on the homepage at 1280x800: **281 CSS animations running at once,
 * 190 of them off screen**, on a page 11.5 viewports tall - and 24.3% CPU while
 * the tab sat completely idle, most of it style recalculation. Every one of
 * those 190 was being recalculated every frame to move pixels nobody could see.
 *
 * That is the whole cause of "homepage pe CPU high rehta hai". It is not one
 * expensive effect; it is a long page where the starfield, the mesh drift, the
 * pulse dots, the 3D icon set and the shine sweeps all keep running to the
 * bottom of the document regardless of where the reader is.
 *
 * ## Why this specific approach
 *
 * - **Nothing visual changes.** An animation is only paused while it is off
 *   screen, and `rootMargin` un-pauses it a full viewport before it arrives, so
 *   it is already running by the time it can be seen. The design is untouched -
 *   which matters, because the motion here is deliberate brand identity, not
 *   decoration (see the reduced-motion policy in CLAUDE.md).
 * - **`content-visibility: auto` was NOT used.** It would do this and more, but
 *   it changes layout geometry, and this project already had to neutralise
 *   `.sect-cv` because that broke anchor-jump scrolling. Pausing an animation
 *   changes no geometry at all.
 * - **Only CSS animations are affected.** `animation-play-state` does not touch
 *   framer-motion's JS/WAAPI animations, so every `<Reveal>` entrance still
 *   plays exactly when it should.
 */

/** Un-pause this far outside the viewport, so nothing is ever seen frozen. */
const MARGIN = "100% 0px";
/** At most one rescan per this window, however many mutations land in it. */
const SCAN_MS = 250;

export function PauseOffscreenAnimations() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) e.target.classList.toggle("anim-paused", !e.isIntersecting);
      },
      { rootMargin: MARGIN }
    );

    // Observe the page's own top-level blocks. `section` covers the marketing
    // pages; the direct children of `main` cover app pages that do not use it.
    //
    // ⚠️ PR 3: this used to run on EVERY DOM mutation anywhere in the body -
    // a fresh `querySelectorAll` plus an `offsetHeight` read on every match,
    // which forces a synchronous layout, on every React commit that added or
    // removed a node (a chat message, a streamed AI token's wrapper, a menu
    // opening). It also never let go of a section once it left the page, so a
    // long session grew the observer's list with detached nodes.
    //
    // Now: mutations are coalesced into one scan at most every SCAN_MS, an
    // element already watched is skipped (so its height is not re-read), and
    // detached ones are released. Pausing a section that appeared 250ms ago is
    // no different to the reader - `MARGIN` already keeps it running a full
    // viewport before it can be seen.
    const watched = new Set<Element>();
    const scan = () => {
      timer = 0;
      for (const el of watched) {
        if (!el.isConnected) {
          io.unobserve(el);
          watched.delete(el);
        }
      }
      document.querySelectorAll("main > *, section").forEach((el) => {
        if (watched.has(el)) return;
        // Skip anything tiny - the bookkeeping would cost more than it saves.
        // Re-checked on later scans, so a block that grows gets picked up.
        if ((el as HTMLElement).offsetHeight > 120) {
          watched.add(el);
          io.observe(el);
        }
      });
    };
    let timer = 0;
    scan();

    // Client-rendered sections arrive after mount (feeds, lists, lazy blocks),
    // so pick those up too rather than only what existed on the first frame.
    const mo = new MutationObserver(() => {
      if (!timer) timer = window.setTimeout(scan, SCAN_MS);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(timer);
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return null;
}
