"use client";

import { useState } from "react";
import { Sparkles, SparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiteMotion } from "@/lib/useClientFlag";
import { hapticToggle } from "@shared/utils/haptics";

/**
 * Animations on / off, as a choice the reader actually gets to make.
 *
 * ## Why this exists
 *
 * The motion tier in `layout.tsx` guesses from device capability, and a guess
 * is wrong for somebody. It was wrong in a very specific way: Chrome reports
 * `navigator.deviceMemory` quantised to a power of two and capped at 8, so a
 * 6 GB desktop reports **4** and was demoted to the lite tier with eight fast
 * cores - while the same machine on Firefox or Safari, which do not expose
 * `deviceMemory` at all, kept the full set. Measured on the homepage: 163
 * running animations against 56. Same site, same person, different answer per
 * browser, and nothing on screen to say why or to change it.
 *
 * The detection is fixed too, but a heuristic will misjudge some other device
 * eventually. This is the part that does not need a redeploy to put right: the
 * reader flips it and it is their answer from then on.
 *
 * ## What "on" overrides
 *
 * Both gates, deliberately:
 *   - the capability tier (`html.lite-motion`), and
 *   - the OS `prefers-reduced-motion` preference, via `html.motion-full`, which
 *     the reduced-motion blocks in globals.css and `useReducedMotionSafe()`
 *     both defer to.
 *
 * Overriding an accessibility preference is only defensible because it is the
 * reader themselves doing it, on their own device, from a labelled control -
 * and because this project already exempts its brand motion from that
 * preference (see the note in globals.css). The scroll-behaviour rule is the
 * one thing "on" does NOT override: calm scrolling is a genuine vestibular
 * accommodation and no one calls a page static because of it.
 *
 * "Off" is the honest opposite - it forces the lite tier on any device, which
 * is a real want on a slow connection or an old phone.
 */
export function MotionToggle({ className = "" }: { className?: string }) {
  // The tier is a class on <html>, so it is a client-only value: read through
  // `useLiteMotion` (useSyncExternalStore with a server snapshot) rather than
  // an effect, and adjusted during render when the real value arrives after
  // hydration. `setState` in an effect body would schedule a second render for
  // something React can settle in the first one - the pattern the news reader
  // and the breaking hero already use here.
  const tierOn = !useLiteMotion();
  const [on, setOn] = useState(tierOn);
  const [prevTier, setPrevTier] = useState(tierOn);
  if (prevTier !== tierOn) {
    setPrevTier(tierOn);
    setOn(tierOn);
  }

  function toggle() {
    hapticToggle();
    const d = document.documentElement;
    const next = d.classList.contains("lite-motion"); // currently off ⇒ turning on
    // Applied immediately so CSS animations respond to the tap rather than
    // waiting for a reload - the same thing ThemeToggle does with `dark`.
    d.classList.toggle("lite-motion", !next);
    d.classList.toggle("motion-full", next);
    try {
      localStorage.setItem("motion", next ? "full" : "lite");
    } catch {
      /* private mode: the choice lasts this page, which is better than nothing */
    }
    setOn(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "Turn animations off" : "Turn animations on"}
      title={on ? "Animations on" : "Animations off"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white/5 transition-colors hover:border-gold-500/30",
        on ? "text-gold-200" : "text-zinc-500 hover:text-zinc-300",
        className
      )}
    >
      {on ? <Sparkles className="h-4 w-4" /> : <SparklesIcon className="h-4 w-4 opacity-60" />}
    </button>
  );
}
