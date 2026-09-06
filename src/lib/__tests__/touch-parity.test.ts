import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// "Mere wale me kuch UX work nahi karta - product ka layout wala, aur hero page
// ka teesre wale me mouse pointer se kuch nahi hota. Mobile me bhi product wala
// layout ka animation nahi hai."
//
// Two separate causes, both of which make the site behave differently from one
// device to the next for reasons nothing on the page explains.
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const read = (p: string) => strip(readFileSync(p, "utf8"));
const hero = read("src/components/Hero.tsx");
const css = readFileSync("src/app/globals.css", "utf8");

const HOVER_SCALE_FILES = [
  "src/components/Products.tsx",
  "src/components/About.tsx",
  "src/components/OrbitalEcosystem.tsx",
  "src/modules/profile/components/ProfileStats.tsx",
  "src/app/u/[username]/page.tsx",
];

describe("the hero medallion tilts for everyone with a mouse", () => {
  it("no longer bails out under the OS reduced-motion preference", () => {
    // `onMove` opened with an early return on
    // `matchMedia("(prefers-reduced-motion: reduce)").matches`, so the 3D tilt
    // was simply dead on any machine with that setting on - and there is
    // nothing on the page to tell you why your desktop behaves differently
    // from someone else's.
    expect(hero).not.toMatch(/prefers-reduced-motion: reduce"\)\.matches\) return/);
  });

  it("still throttles to one update per frame", () => {
    // The reason this function is careful in the first place: a 120Hz mouse
    // fires mousemove faster than the eye can use.
    expect(hero).toMatch(/if \(moveRaf\.current\) return;/);
    expect(hero).toMatch(/requestAnimationFrame\(/);
  });
});

describe("touch gets the same feedback a mouse gets", () => {
  it("every hover-only icon scale has a press equivalent", () => {
    // `group-hover:` never fires on a touch screen, so on a phone these icons
    // did not move at all - the cards looked completely inert next to the same
    // cards on a laptop.
    for (const f of HOVER_SCALE_FILES) {
      const src = readFileSync(f, "utf8");
      const hovers = src.match(/group-hover:scale-110/g)?.length ?? 0;
      const actives = src.match(/group-active:scale-110/g)?.length ?? 0;
      expect(actives, `${f} has ${hovers} hover scales but ${actives} press ones`).toBe(hovers);
    }
  });

  it("the product-card arrow nudges on press too", () => {
    const src = readFileSync("src/components/Products.tsx", "utf8");
    expect(src).toMatch(/group-active:-translate-y-0\.5 group-active:translate-x-0\.5 group-active:text-gold-200/);
  });

  it("the card highlight is reachable by touch", () => {
    // `.surface-hover` carried the gold border and lit background that say
    // "this is the one you picked". Hover-only meant a phone never saw it.
    expect(css).toMatch(/\.surface-hover:active \{\s*border-color: rgba\(226, 167, 47, 0\.35\);/);
  });
});

describe("a tapped card does not stay stuck looking hovered", () => {
  it("scopes the hover rules to devices that actually hover", () => {
    // Without this, mobile browsers leave `:hover` applied after a tap, so one
    // card sits lit up and lifted until you tap somewhere else - which reads as
    // a rendering bug rather than a hover state.
    expect(css).toMatch(/@media \(hover: hover\) \{\s*\.surface-hover:hover \{/);
    expect(css).toMatch(/@media \(hover: hover\) \{\s*\.lift:hover \{/);
  });

  it("keeps the press state outside the media query", () => {
    // `:active` is the touch path - gating it on `hover: hover` would undo the
    // whole point.
    const activeAt = css.indexOf(".surface-hover:active");
    const mediaAt = css.indexOf("@media (hover: hover)");
    expect(activeAt).toBeGreaterThan(mediaAt);
    expect(css).toMatch(/\.lift:active \{/);
  });
});
