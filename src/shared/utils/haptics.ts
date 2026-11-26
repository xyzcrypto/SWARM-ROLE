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

/**
 * ## Levels (2026-09-28, owner request)
 *
 * The owner asked for haptics on every chat interaction, and for them to be
 * felt. So the chat surfaces now let each member choose (chat-feel.ts):
 *
 *   off       nothing
 *   standard  the default: a light tick on every control in the chat, plus the
 *             tap / toggle / error / sent patterns below
 *   strong    the same, roughly twice as long
 *
 * A member who picks a level themselves has asked for it, so their choice
 * overrides `prefers-reduced-motion` - Android turns that on under battery
 * saver, which silently switched haptics off for many phones and is a large
 * part of why they were barely felt. With no explicit choice, reduced motion
 * is still respected.
 */
import { getFeel } from "./chat-feel";

/** Durations in ms, at the standard level. */
const PATTERNS = {
  select: 8,
  tap: 14,
  toggle: 22,
  sent: [10, 40, 18],
  error: [16, 50, 16],
} as const;

function level(): { on: boolean; scale: number } {
  const f = getFeel();
  if (f.haptics === "off") return { on: false, scale: 0 };
  return { on: true, scale: f.haptics === "strong" ? 2 : 1 };
}

function enabled(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (typeof navigator.vibrate !== "function") return false;
  // Before the first tap on the page the browser refuses to vibrate and logs
  // an intervention warning for every attempt (an auto-played sound on a page
  // load used to do this). Skip quietly until the page has been touched.
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (ua && !ua.hasBeenActive) return false;
  const f = getFeel();
  if (f.haptics === "off") return false;
  if (f.hapticsChosen) return true; // the member asked for it
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  } catch {
    /* matchMedia unavailable - fall through and allow */
  }
  return true;
}

/** Scale a pattern: vibrate segments longer, pauses unchanged. Pure; exported for tests. */
export function scalePattern(pattern: number | readonly number[], scale: number): number | number[] {
  if (typeof pattern === "number") return Math.round(pattern * scale);
  return pattern.map((ms, i) => (i % 2 === 0 ? Math.round(ms * scale) : ms));
}

function fire(pattern: number | readonly number[]): void {
  if (!enabled()) return;
  const { on, scale } = level();
  if (!on) return;
  try {
    navigator.vibrate(scalePattern(pattern, scale));
  } catch {
    /* Some browsers throw on odd patterns or in cross-origin frames. A failed
       buzz must never surface to the user or break the action it accompanied. */
  }
}

/** The lightest tick: any control pressed in a chat surface. */
export const hapticSelect = () => fire(PATTERNS.select);

/** A committed action: sent, submitted, confirmed. */
export const hapticTap = () => fire(PATTERNS.tap);

/** A state flip the user should feel land: like, pin, save, theme. */
export const hapticToggle = () => fire(PATTERNS.toggle);

/** A message went out: a distinct double tick. */
export const hapticSent = () => fire(PATTERNS.sent);

/** A rejected action. The only pattern with two equal pulses, so it reads as "no". */
export const hapticError = () => fire(PATTERNS.error);

/** A test buzz for the settings sheet, ignoring reduced-motion (the member is asking). */
export function hapticPreview(kind: "select" | "tap" | "toggle" | "sent" = "tap"): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  const { on, scale } = level();
  if (!on) return;
  try { navigator.vibrate(scalePattern(PATTERNS[kind], scale)); } catch { /* ignore */ }
}

/** True when this device can actually produce haptics. Exported for tests and
 *  for any UI that wants to offer a setting rather than assume. */
export const hapticsAvailable = enabled;

/** Whether this device has a vibration motor the web can reach at all. */
export const hapticsSupported = () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
