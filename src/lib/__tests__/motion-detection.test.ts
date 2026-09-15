import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// "Mere desktop pe animation static hai, doosre device pe chalta hai", and then
// "sare specs ke device me same animation show hona chahiye".
//
// Both reports are the same root cause: the tier was decided by
// `navigator.deviceMemory`, which is the one input that gives different answers
// for identical hardware depending on which browser is open.
//
//   - Chrome quantises it to a power of two capped at 8, so a 6 GB machine
//     reports **4**. That demoted 6 GB desktops with eight fast cores:
//
//         deviceMemory 8 (>=8GB desktop) ... 163 running animations
//         deviceMemory 4 (6GB desktop)   ....  56          <- the first report
//
//     Pairing the clause with `(pointer: coarse)` fixed the desktop half.
//
//   - It does not exist at all on iOS Safari or Firefox. So the coarse-pointer
//     fix left every iPhone falling through to the FULL tier - the expensive
//     one - while Chrome Androids reporting 4 got the lite one. Measured on the
//     homepage at 393x851, production build, 4x CPU throttle:
//
//         Android reporting 4 GB ..... lite ... 17 anims ... 55.5 fps
//         iPhone (no deviceMemory) ... FULL ... 55 anims ... 31.4 fps
//         Android reporting 8 GB ..... FULL ... 55 anims ... 30.6 fps
//
//     Same site, same class of phone, a different answer per browser - and the
//     phones the heuristic could not identify were the ones handed the janky
//     page. That is the second report, and it cut both ways: some readers saw a
//     static site, others a stuttering one.
//
// A phone is a phone whatever it reports. `(pointer: coarse)` plus a short
// screen edge identifies one on every browser, so every phone now lands on the
// same tier: 27 on-screen animations at 41.9 fps.
const strip = (s: string) => s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ");
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

describe("the capability tier is decided by device class, not by a browser API", () => {
  it("does not read navigator.deviceMemory at all", () => {
    // The whole bug, both halves of it. Reintroducing this input brings back
    // the per-browser split - nothing else about `deviceMemory` has changed.
    // Checked against the stripped file: the prose above names it repeatedly.
    expect(strip(layout)).not.toContain("deviceMemory");
  });

  it("identifies a phone by a coarse pointer plus a short screen edge", () => {
    expect(script).toContain("matchMedia('(pointer: coarse)')");
    expect(script).toContain("Math.min(w,h)<600");
  });

  it("measures the SCREEN, so rotating a phone does not flip tiers mid-session", () => {
    // `innerWidth` on a 430x932 phone in landscape is 932, over any sane phone
    // threshold - so turning the phone sideways would have crossed into the
    // full tier and changed the page. The screen's shorter side is the same
    // number in both orientations.
    expect(script).toContain("var s=window.screen||{}");
    expect(script).toContain("w=s.width||window.innerWidth");
    expect(script).toContain("h=s.height||window.innerHeight");
  });

  it("leaves tablets and desktops on the full tier", () => {
    // The frame-rate problem was only ever measured on a phone. An iPad's
    // shorter side is 820, so the `<600` clause excludes it by construction -
    // this asserts the threshold has not drifted up into tablet territory.
    expect(script).not.toMatch(/Math\.min\(w,h\)<(6[1-9]\d|[7-9]\d\d|\d{4})/);
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
