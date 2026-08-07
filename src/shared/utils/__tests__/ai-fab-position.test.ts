import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// The launcher disappeared from the page because a hand-written rule at the end
// of globals.css set `.ai-fab { position: relative }`. Tailwind flattens its
// layers at build time, so in the emitted stylesheet plain source order decides
// - and anything appended to globals.css lands AFTER `.fixed{position:fixed}`
// and wins. The button fell out of the viewport corner into normal document
// flow at the end of <body>, ~2000px down, invisible.
//
// Measured both ways in a browser before writing this: with the rule the
// computed position was `relative` at y=1980 and out of view; without it,
// `fixed` at the bottom-right corner.
const css = readFileSync("src/app/globals.css", "utf8");

/** Every `.ai-fab` rule body in the file (excludes ::before/::after/descendants). */
function aiFabBlocks(): string[] {
  return [...css.matchAll(/(^|\})\s*([^{}]*\.ai-fab)\s*\{([^}]*)\}/g)]
    .filter((m) => !/::?(before|after|hover|active)|\.ai-fab[-\w]/.test(m[2]))
    .map((m) => m[3]);
}

describe("the XYZ AI launcher must stay fixed to the viewport", () => {
  it("no hand-written rule sets `position` on .ai-fab", () => {
    for (const body of aiFabBlocks()) {
      expect(body).not.toMatch(/(^|;)\s*position\s*:/);
    }
  });

  it("no hand-written rule sets `transform` on .ai-fab", () => {
    // A `transform` here silently wipes the drag offset, which is applied as an
    // inline translate - the launcher would snap back to the corner mid-drag.
    for (const body of aiFabBlocks()) {
      expect(body).not.toMatch(/(^|;)\s*transform\s*:/);
    }
    expect(css).not.toMatch(/\.ai-fab:active\s*\{[^}]*transform/);
  });
});
