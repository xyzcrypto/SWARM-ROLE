import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// "Mere desktop pe animation static hai, doosre device pe chalta hai."
//
// The motion tier demoted a machine to `html.lite-motion` when
// `navigator.deviceMemory <= 4`. Chrome reports that value quantised to a power
// of two and capped at 8, so a 6 GB desktop reports **4** and was demoted with
// eight fast cores - while the same machine on Firefox or Safari, which do not
// expose `deviceMemory` at all, kept everything. Measured on the homepage with
// a production build:
//
//   deviceMemory 8 (>=8GB desktop) ... 163 running animations
//   deviceMemory 4 (6GB desktop)   ....  56          <- the bug
//   no deviceMemory (FF/Safari)    ... 163
//
// Same site, same person, a different answer per browser.
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");
const flags = strip(readFileSync("src/shared/hooks/useClientFlag.ts", "utf8"));

/**
 * The inline pre-paint script. Matched against the whole file rather than
 * extracted: it is one minified string literal with no spaces, and the prose
 * around it writes the same expressions WITH spaces, so the un-spaced forms
 * below can only be the script itself.
 */
const script = layout;

describe("the capability tier stops guessing about desktops", () => {
  it("pairs the memory clause with a coarse pointer", () => {
    // The measurement the tier exists for was taken on a PHONE (390x844, 6x CPU
    // throttle). Keeping memory as a signal only where a touch pointer says
    // "phone" preserves that case exactly and stops demoting desktops, where
    // RAM says nothing about whether CSS animations hold 60fps.
    expect(script).toContain("coarse&&typeof mem==='number'&&mem<=4");
    expect(script).not.toMatch(/\|\|\(typeof mem==='number'&&mem<=4\)\|\|/);
  });

  it("still catches a genuinely weak machine of any shape", () => {
    expect(script).toContain("(n.hardwareConcurrency||8)<=2");
  });

  it("still honours an explicit data-saver request", () => {
    expect(script).toContain("c.saveData===true");
  });

  it("reads the pointer defensively", () => {
    // `matchMedia` throws in some embedded webviews, and this script runs
    // before paint on every page - it must never be the thing that breaks one.
    expect(script).toMatch(/try\{coarse=matchMedia\('\(pointer: coarse\)'\)\.matches;\}catch\(e\)\{\}/);
  });
});

describe("an explicit choice beats every guess", () => {
  it("the script marks a forced-full session", () => {
    expect(script).toContain("if(m==='full'){d.classList.add('motion-full');}");
  });

  it("forced-full overrides the reduced-motion CSS", () => {
    // Each of these used to apply unconditionally under the OS preference.
    for (const sel of [
      /html:not\(\.motion-full\) \.btn-press:active::before \{ animation: none; \}/,
      /html:not\(\.motion-full\) \.flash-up, html:not\(\.motion-full\) \.flash-down \{ animation: none; \}/,
      /html:not\(\.motion-full\) \.shimmer::after \{ animation: none; \}/,
      /html:not\(\.motion-full\) \.route-enter \{ animation: none; \}/,
    ]) {
      expect(css).toMatch(sel);
    }
  });

  it("does NOT override calm scrolling", () => {
    // The one reduced-motion accommodation that stays: a real vestibular
    // trigger, and nobody calls a page static because it scrolls calmly.
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]{0,900}?\n {2}html \{ scroll-behavior: auto; \}/);
  });

  it("forced-full overrides the reduced-motion HOOK too", () => {
    // Framer-driven entrances are gated on this (`initial={reduce ? false :
    // ...}`), and they appear in neither `getAnimations()` nor
    // `animation-play-state` - so CSS alone cannot reach them.
    expect(flags).toMatch(/return prefersReduced && !forced;/);
    expect(flags).toMatch(/export function useMotionForced\(\): boolean/);
    expect(flags).toMatch(/classList\.contains\("motion-full"\)/);
  });
});
