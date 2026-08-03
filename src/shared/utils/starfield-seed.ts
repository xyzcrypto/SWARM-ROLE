/**
 * Seed math for the homepage starfield, kept out of the component so it can be
 * tested - because the property it has to hold is not obvious by reading it.
 *
 * ## Why quantizing matters
 *
 * ECMAScript does not require `Math.sin` to be correctly rounded; it is
 * explicitly implementation-approximated. Node (which server-renders the page)
 * and V8-in-Chromium (which hydrates it) therefore disagree in the last bits.
 * Observed on `/`:
 *
 *     server HTML:      left:5.721816934965318%
 *     browser computed: left:5.721816935692914%
 *
 * React compares hydrated style values as strings, so all 110 stars reported an
 * attribute mismatch. It is silent in production and cosmetically harmless, but
 * it is real nondeterminism across the SSR boundary and it buried the genuine
 * hydration errors in dev noise.
 *
 * `QUANTUM` snaps the three seed fractions to a grid coarse enough that both
 * engines land on the same number. Everything downstream is ordinary IEEE
 * arithmetic, which IS exactly reproducible, so quantizing here is sufficient -
 * the derived values do not need rounding of their own.
 */

/** Decimal places kept from each `Math.sin`-derived fraction. */
export const QUANTUM = 1e4;

export const quantize = (n: number): number => Math.round(n * QUANTUM) / QUANTUM;

export type StarSeed = { fa: number; fb: number; fc: number };

/** The three independent [0,1) fractions for star `i`, engine-stable. */
export function starSeed(i: number): StarSeed {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.6789;
  const c = Math.sin(i * 45.164) * 91537.4231;
  return {
    fa: quantize(Math.abs(a - Math.floor(a))),
    fb: quantize(Math.abs(b - Math.floor(b))),
    fc: quantize(Math.abs(c - Math.floor(c))),
  };
}

export const STAR_COUNT = 110;

/**
 * How close any seed in the live star set comes to a rounding boundary, i.e.
 * how much engine disagreement the quantum can absorb before two engines round
 * to different numbers. For the live set it is 2.61e-4, against an observed
 * divergence of 7.28e-8 at the same scale - roughly 3600x of headroom. The test
 * asserts it stays there, so a future change to the count or the multipliers
 * cannot silently reintroduce the mismatch.
 */
export function closestBoundaryDistance(count = STAR_COUNT): number {
  let worst = Infinity;
  for (let i = 0; i < count; i++) {
    const a = Math.sin(i * 12.9898) * 43758.5453;
    const b = Math.sin(i * 78.233) * 12345.6789;
    const c = Math.sin(i * 45.164) * 91537.4231;
    for (const v of [a, b, c]) {
      const scaled = Math.abs(v - Math.floor(v)) * QUANTUM;
      worst = Math.min(worst, Math.abs(scaled - Math.floor(scaled) - 0.5));
    }
  }
  return worst;
}
