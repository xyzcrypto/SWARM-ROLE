import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// News, design pass. Found by rendering /news with realistic stubbed stories at
// 1280x1100 and 390x900 and looking at it. Both findings are measurable rather
// than matters of taste.
//
// Real source path on purpose: `src/components/*` is a re-export shim after
// #203, so reading one matches nothing and passes while verifying nothing.
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const N = strip(readFileSync("src/modules/news/components/NewsClient.tsx", "utf8"));
const css = readFileSync("src/app/globals.css", "utf8");

describe("the breaking hero's arrows do not sit on the headline", () => {
  it("steps them aside below sm", () => {
    // Measured at 390px: the hero is `h-56` (224px); the arrows sit at
    // `top-1/2` and are 36px tall, so they span y=94-130. The content block is
    // bottom-anchored and ~142px tall on a two-line headline, spanning
    // y=82-224. The left arrow covered the "B" of the BREAKING badge.
    expect(N).toMatch(/aria-label="Previous breaking story"[\s\S]{0,220}hidden h-9 w-9 sm:grid/);
    expect(N).toMatch(/aria-label="Next breaking story"[\s\S]{0,220}hidden h-9 w-9 sm:grid/);
  });

  it("keeps them on wider screens, where they fit", () => {
    // `sm:grid` rather than deleting them - the overlap is a phone problem.
    expect(N).not.toMatch(/aria-label="Previous breaking story"[\s\S]{0,220}z-10 grid h-9/);
  });

  it("does not nudge them up instead", () => {
    // A percentage offset would hold until the first three-line headline, which
    // is exactly the kind of fix that comes back.
    expect(N).not.toMatch(/top-\[\d+%\] sm:top-1\/2/);
  });
});

describe("the dots are a real tap target", () => {
  it("uses the project's hit-area helper", () => {
    // With the arrows gone below sm these are the only control a phone has, and
    // they were `h-1.5` - a 6px target.
    expect(N).toMatch(/className=\{cn\("tap-target-all h-1\.5 rounded-full transition-all"/);
  });

  it("grows the hit area, not the dot", () => {
    // The helper is a transparent pseudo-element, so the dot still looks like a
    // dot - the same approach the perp chart's timeframe pills use.
    expect(css).toMatch(/\.tap-target-all::after \{\s*inset: -8px;/);
    expect(N).toMatch(/w-5 bg-white" : "w-1\.5 bg-white\/40/);
  });
});
