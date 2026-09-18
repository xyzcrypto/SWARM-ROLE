"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A sticky index for a long page.
 *
 * ⚠️ Plain `<a href="#id">` on purpose. The site runs Lenis, which owns page
 * scroll and undoes any programmatic `scrollTo` it did not initiate - a hand
 * -rolled smooth scroll here would be silently cancelled. Native anchor
 * navigation is handled by `HashScroll`, mounted in the layout, which already
 * knows about that.
 *
 * ## Two bugs this file exists in its current form because of
 *
 * **1. It was see-through.** The bar used `.glass`, a translucent surface meant
 * for overlays on a dark ambient background. Sitting above dense cards it let
 * their text read straight through the labels, so mid-scroll the bar rendered
 * as superimposed strings - "RiseFarmingVariational" - and looked like a
 * rendering fault rather than a nav. A bar that floats over content has to be
 * opaque; there is no amount of blur that substitutes for that.
 *
 * **2. It was always there.** A bar pinned below the site header costs ~44px of
 * a phone viewport permanently, and on this page it sat directly on top of the
 * first card. It now hides when you scroll DOWN and returns when you scroll UP,
 * which is the standard behaviour for exactly this reason: going down you want
 * the content, coming up you want the controls.
 *
 * ## Hydration
 *
 * Visibility starts `true` and only ever changes inside an effect. Deriving it
 * from `window.scrollY` during render would be a client-only signal reaching the
 * DOM, which is the React #418 trap documented in CLAUDE.md and the worst bug
 * this site has shipped.
 */
export type NavSection = { id: string; label: string };

export function PointsNav({ sections }: { sections: NavSection[] }) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");
  const [shown, setShown] = useState(true);
  const lastY = useRef(0);

  // Scroll-spy via IntersectionObserver rather than a scroll handler: no work
  // on frames where nothing crossed a boundary, and no scroll listener fighting
  // Lenis for the same events.
  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((e): e is HTMLElement => Boolean(e));
    if (!els.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        // The topmost section currently intersecting wins. Taking the most
        // recent entry instead would make the marker jump backwards when two
        // boundaries cross in one frame.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // Top-weighted: a section counts as current once its heading is near the
      // top of the viewport, not when its last pixel leaves the bottom.
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 }
    );
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, [sections]);

  /**
   * Hide on a SUSTAINED downward scroll, reveal on the first hint of upward.
   *
   * ⚠️ The first version hid the bar after 8px of downward movement, which is
   * less than one notch of a mouse wheel. Nudging the page a little made the
   * nav vanish, and since it only returned on an upward scroll, a reader
   * inching down a long page lost it constantly - it read as flickering, not as
   * behaviour.
   *
   * So the two directions are deliberately ASYMMETRIC, because the costs are:
   * hiding wrongly steals a control the reader wanted, while revealing wrongly
   * costs 44px for a moment. Hiding needs 140px of accumulated downward intent;
   * revealing needs 24px up. The accumulator resets whenever the direction
   * changes, so a hesitant scroll never adds up to a hide.
   *
   * It also stays put in the first 240px, where the bar is part of the header
   * rather than a floating control.
   */
  useEffect(() => {
    lastY.current = window.scrollY;
    let frame = 0;
    let downAccum = 0;
    let upAccum = 0;
    const HIDE_AFTER = 260;
    const SHOW_AFTER = 24;
    const TOP_ZONE = 240;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const dy = y - lastY.current;
        lastY.current = y;
        // 2px, not 8: this filters sub-pixel jitter only. The real threshold is
        // the accumulator below, which is what stops the twitchiness.
        if (Math.abs(dy) < 2) return;

        if (y < TOP_ZONE) {
          downAccum = 0;
          upAccum = 0;
          setShown(true);
          return;
        }
        if (dy > 0) {
          upAccum = 0;
          downAccum += dy;
          if (downAccum > HIDE_AFTER) setShown(false);
        } else {
          downAccum = 0;
          upAccum -= dy;
          if (upAccum > SHOW_AFTER) setShown(true);
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // ⚠️ The hidden state must take NO VERTICAL SPACE.
  //
  // Fading the bar out left its box exactly where it was - a `sticky` element
  // stays in normal flow - so scrolling down produced a ~56px hole between the
  // band above and the first panel below. The bar had not got out of the way; it
  // had just become invisible furniture, which is what "gap dikhta hai" was.
  //
  // So the outer element animates its ROW HEIGHT (`grid-rows-[1fr]` -> `[0fr]`)
  // alongside the fade. The inner `min-h-0 overflow-hidden` child is required
  // for that trick: without it the content sets the row height and nothing
  // collapses.
  return (
    <nav
      aria-label="Sections"
      className={cn(
        "sticky top-16 z-30 -mx-1 grid px-1 transition-all duration-200 ease-out sm:top-20",
        shown ? "grid-rows-[1fr] py-2 opacity-100" : "pointer-events-none grid-rows-[0fr] py-0 opacity-0"
      )}
    >
      <div className="min-h-0 overflow-hidden">
      {/* ⚠️ `bg-base`, an OPAQUE token, not `.glass`. See the note above: a
          translucent bar over dense cards renders their text through the labels.
          The blur is decoration on top of an opaque ground, not a substitute
          for one.

          ⚠️ And NO opacity modifier. `bg-base/95` looks reasonable and produces
          **nothing at all**: these semantic tokens are declared as plain
          `var(--bg)` in tailwind.config.ts, not in the `rgb(... /
          <alpha-value>)` form an opacity modifier requires, so Tailwind emits no
          background rule and the bar was measured fully transparent - the exact
          bug this comment block was written to fix, reintroduced by the fix.
          Same family as the `text-content0` incident: a class that parses, means
          nothing, and fails silently. */}
      <div className="relative overflow-hidden rounded-2xl border border-hairline bg-base shadow-card backdrop-blur-xl">
        {/* Edge fades tell you the row scrolls, which on a phone is the
            difference between eight sections and the three that happen to fit.
            Pointer-events-none so they never eat a tap on the first chip. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-base to-transparent"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-base to-transparent"
        />
        <div className="flex gap-1 overflow-x-auto p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              aria-current={active === s.id ? "true" : undefined}
              className={cn(
                // `min-h-9` so every chip is a comfortable tap target on a
                // phone without making the bar taller on a desktop.
                "inline-flex min-h-9 shrink-0 items-center rounded-xl px-3 text-xs font-medium transition-colors",
                active === s.id
                  ? "bg-gold-500/15 text-gold-200 ring-1 ring-gold-500/30"
                  : "text-content-muted hover:text-content active:text-content"
              )}
            >
              {s.label}
            </a>
          ))}
        </div>
        </div>
      </div>
    </nav>
  );
}
