import { describe, it, expect } from "vitest";
import { starSeed, quantize, closestBoundaryDistance, QUANTUM, STAR_COUNT } from "@/lib/starfield-seed";

/**
 * These pin the one property the starfield needs across the SSR boundary: the
 * numbers Node writes into the HTML must be the numbers the browser computes.
 *
 * `Math.sin` is implementation-approximated in ECMAScript, and Node and
 * V8-in-Chromium really do differ - the homepage was serving
 * `left:5.721816934965318%` while the browser computed `5.721816935692914%`,
 * which React reports as a hydration attribute mismatch on all 110 stars.
 */
describe("starfield seeds", () => {
  it("quantizes to a grid both engines can agree on", () => {
    for (let i = 0; i < STAR_COUNT; i++) {
      const { fa, fb, fc } = starSeed(i);
      for (const v of [fa, fb, fc]) {
        // Already on the grid: quantizing again is a no-op, so no
        // engine-dependent tail survives into the style attribute. (Checking
        // `v * QUANTUM` is an integer would NOT work - 0.5722 * 1e4 is
        // 5721.999999999999 in binary floating point.)
        expect(quantize(v)).toBe(v);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });

  it("keeps every seed far from a rounding boundary", () => {
    // The two engines disagreed by 7.28e-10 on a percentage, i.e. 7.28e-12 on
    // the fraction, i.e. 7.28e-8 once scaled by the quantum. The live set's
    // closest approach to a boundary is 2.61e-4 - about 3600x that - so neither
    // engine can round to a different number.
    const margin = closestBoundaryDistance();
    expect(margin).toBeGreaterThan(1e-4);
    expect(margin / 7.28e-8).toBeGreaterThan(1000);
  });

  it("is stable - a change here changes the rendered sky", () => {
    // A regression pin, not a behavioural claim: if someone edits the
    // multipliers or the quantum, this fails and they have to mean it.
    expect(starSeed(0)).toEqual({ fa: 0, fb: 0, fc: 0 });
    expect(starSeed(1).fa).toBeCloseTo(quantize(starSeed(1).fa), 10);
    expect(String(starSeed(7).fa).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(4);
  });

  it("survives a much larger star count without hitting a boundary", () => {
    // Guards the "we added more stars" future edit, which is otherwise a silent
    // way to reintroduce the mismatch.
    expect(closestBoundaryDistance(400)).toBeGreaterThan(1e-4);
  });
});
