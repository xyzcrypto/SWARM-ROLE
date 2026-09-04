/**
 * Tiny deterministic PRNG (mulberry32) for decorative fields.
 *
 * Written for the WebGL orbital's star/dust fields, which have since been
 * deleted; it lives here rather than in that folder because the CSS orbital
 * (`OrbitalEcosystem`) uses it for its particle field and is the only caller
 * left. Generic enough that this is where it belonged anyway.
 *
 * Those fields used to seed themselves with `Math.random()` inside a
 * `useMemo`. That is an impure call during render: React may re-run the memo
 * (StrictMode double-render, a cache miss on remount), and the whole field
 * would silently jump to a different layout. It also trips
 * `react-hooks/purity`.
 *
 * A fixed seed gives the same statistical spread with none of that - the field
 * looks identical run to run and is stable across re-renders, which is what we
 * actually want for a background.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
