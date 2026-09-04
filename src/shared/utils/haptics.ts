/**
 * Haptic feedback, feature-detected and deliberately rare.
 *
 * ## What actually works
 *
 * The Vibration API (`navigator.vibrate`) is supported on Android Chrome/Edge
 * and Firefox. **iOS Safari does not support it at all** and never has - there
 * is no way to trigger a taptic pulse from a web page on iPhone. So this is a
 * progressive enhancement for roughly the Android half of mobile traffic, and
 * every call site must still look and behave correctly with it doing nothing.
 * That is why nothing here returns a promise or is awaited: a caller must never
 * be able to write code that depends on the buzz happening.
 *
 * It also requires a user gesture, so calling it outside a real event handler is
 * silently ignored by the browser - another reason not to build anything on top
 * of it.
 *
 * ## Why the surface is this small
 *
 * The brief was explicit: do not fake or overuse haptics. A phone that buzzes on
 * every tap is worse than one that never buzzes, because the signal stops
 * meaning anything. So there are three intensities and they are reserved for
 * actions where something actually happened:
 *
 *   tap()     a committed action - sending, submitting, confirming
 *   toggle()  a state flip the user should feel land - like, pin, theme
 *   error()   a rejected action - the only double-pulse, because "something
 *             went wrong" is the one message worth a distinct pattern
 *
 * Navigation, hover, scrolling and opening menus deliberately get nothing. They
 * already have visual feedback and are far too frequent.
 *
 * ## Reduced motion
 *
 * Honoured. `prefers-reduced-motion` is about vestibular comfort rather than
 * touch, so this is arguably optional - but a reader who has asked the system to
 * calm down is not asking for their phone to buzz more, and the project's own
 * policy exempts brand animation, not physical feedback. Cheap to respect, so
 * it is respected.
 */

/** Durations in ms. Short: a haptic you notice consciously is too long. */
const PATTERNS = {
  tap: 10,
  toggle: 16,
  error: [12, 40, 12],
} as const;

function enabled(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (typeof navigator.vibrate !== "function") return false;
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  } catch {
    /* matchMedia unavailable - fall through and allow */
  }
  return true;
}

function fire(pattern: number | readonly number[]): void {
  if (!enabled()) return;
  try {
    navigator.vibrate(pattern as number | number[]);
  } catch {
    /* Some browsers throw on odd patterns or in cross-origin frames. A failed
       buzz must never surface to the user or break the action it accompanied. */
  }
}

/** A committed action: sent, submitted, confirmed. */
export const hapticTap = () => fire(PATTERNS.tap);

/** A state flip the user should feel land: like, pin, save, theme. */
export const hapticToggle = () => fire(PATTERNS.toggle);

/** A rejected action. The only pattern with two pulses, so it reads as "no". */
export const hapticError = () => fire(PATTERNS.error);

/** True when this device can actually produce haptics. Exported for tests and
 *  for any UI that wants to offer a setting rather than assume. */
export const hapticsAvailable = enabled;
