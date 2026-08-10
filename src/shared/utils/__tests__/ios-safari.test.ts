import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// iOS-specific rules.
//
// ⚠️ A real Safari engine could NOT be installed in this environment - the
// WebKit download is blocked - so these pin the two things that were actually
// found by reading the code and measured in an iPhone device profile. They are
// not a claim that Safari as a whole was verified.
const css = readFileSync("src/app/globals.css", "utf8");

describe("backdrop-filter must always be paired with the -webkit- prefix", () => {
  // iOS Safari before 18 ignores the unprefixed property entirely, so a glass
  // panel renders flat there instead of frosted.
  it("has no unprefixed backdrop-filter without a prefixed twin nearby", () => {
    const lines = css.split("\n");
    const orphans: number[] = [];
    lines.forEach((l, i) => {
      if (/(?<!-webkit-)\bbackdrop-filter\s*:/.test(l)) {
        const ctx = lines.slice(Math.max(0, i - 2), i + 3).join("\n");
        if (!ctx.includes("-webkit-backdrop-filter")) orphans.push(i + 1);
      }
    });
    expect(orphans).toEqual([]);
  });
});

describe("focusing a field must not zoom the page on iOS", () => {
  const block = css.match(/@media \(pointer: coarse\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

  // Safari zooms the viewport when a focused control is under 16px, and does
  // not zoom back out. Measured in an iPhone 13 profile: inputs read 16px after
  // this rule, and 14px on desktop - so the desktop design is untouched.
  it("lifts small form controls to 16px on coarse pointers only", () => {
    expect(css).toMatch(/@media \(pointer: coarse\)/);
    expect(block).toMatch(/font-size: max\(16px, 1em\)/);
  });

  // A flat `font-size: 16px` would SHRINK controls that are deliberately
  // bigger. max() only ever lifts.
  it("uses max() rather than a flat size, so nothing shrinks", () => {
    expect(block).not.toMatch(/font-size:\s*16px\s*;/);
  });

  // These carry no text and iOS does not zoom for them, so their sizing stays
  // under the design's control.
  it("excludes checkboxes, radios and ranges", () => {
    for (const t of ["checkbox", "radio", "range"]) expect(block).toContain(t);
  });
});
