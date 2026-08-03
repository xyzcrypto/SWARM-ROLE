"use client";

import { useCallback, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};
const serverFalse = () => false;

/**
 * Read a client-only boolean (a browser capability, a stored preference, a
 * media query) without tripping a hydration mismatch.
 *
 * The pattern this replaces is `useState(false)` plus
 * `useEffect(() => setValue(read()), [])`, which renders once with the wrong
 * value and then immediately schedules a second render - the cascading-render
 * shape `react-hooks/set-state-in-effect` warns about. `useSyncExternalStore`
 * expresses the same intent directly: React reads `serverSnapshot` while
 * server-rendering and hydrating, then swaps to the real value.
 *
 * `read` must return a primitive so React's referential comparison settles.
 */
export function useClientFlag(read: () => boolean, subscribe: (cb: () => void) => () => void = noopSubscribe): boolean {
  return useSyncExternalStore(subscribe, read, serverFalse);
}

/** True once the component has hydrated on the client; false during SSR. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, serverFalse);
}

/**
 * Track a CSS media query. Unlike a one-shot `matchMedia` read in an effect,
 * this also updates if the query starts matching later (device rotated, window
 * resized across a breakpoint, a pointer device attached).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    [query],
  );
  const read = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, read, serverFalse);
}

/**
 * Whether the visitor prefers reduced motion - safe to render from.
 *
 * Use this instead of framer-motion's `useReducedMotion()` anywhere the answer
 * reaches the DOM. framer-motion's version returns `null` while server
 * rendering but reads `matchMedia` synchronously during the FIRST client
 * render, so server and client disagree and React tears down the server markup
 * (`Minified React error #418`). That is not a theoretical risk: it is what put
 * the whole site's content behind a hydration failure, and the surprises are
 * not limited to obviously-visual props - framer-motion emits a `tabindex`
 * attribute when a `whileTap`/`whileHover` gesture is present, so even
 * `whileTap={reduced ? undefined : ...}` changes the rendered HTML.
 *
 * This one is backed by `useSyncExternalStore`, so hydration sees the same
 * value the server did and the real preference arrives on the next render.
 * framer-motion's hook is still fine for values that never reach the DOM (a
 * scroll `behavior`, a duration passed to an imperative animation).
 */
export function useReducedMotionSafe(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
