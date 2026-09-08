import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

// Markets, second pass. Same theme as markets-integrity.test.ts - the page must
// not present something it made up, or cannot show, as if it were the market -
// but on the three surfaces that pass missed: the perp charts, the two detail
// pages, and one component that renders nowhere at all.
//
// Real source paths on purpose: `src/components/*` and `src/lib/*` are
// re-export shims after #203.
const strip = (s: string) => s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ");
const read = (p: string) => strip(readFileSync(p, "utf8"));
const chart = read("src/modules/markets/components/PerpChart.tsx");
const coin = read("src/modules/markets/components/CoinDetailClient.tsx");
const protocol = read("src/modules/markets/components/ProtocolDetailClient.tsx");

describe("the perp chart draws data or nothing", () => {
  it("has no candle generator left in it", () => {
    // `makeFallback(base)` walked a sine wave out from a hardcoded price and
    // seeded state with 44 candles from it. That is what rendered on first
    // paint and for as long as /api/chart was unreachable: bodies, wicks, a
    // trend - a chart with no data behind it, on a markets page.
    expect(chart).not.toMatch(/makeFallback/);
    expect(chart).not.toMatch(/Math\.sin/);
  });

  it("starts empty rather than pre-filled", () => {
    expect(chart).toMatch(/useState<Snapshot \| null>\(null\)/);
  });

  it("says which of the two empty states it is in", () => {
    // "Chart unavailable" and "Loading chart…" are different facts. The old
    // code could express neither, because it always had something to draw.
    expect(chart).toMatch(/failed \? "Chart unavailable" : "Loading chart…"/);
  });

  it("keys its data by coin and timeframe", () => {
    // Tapping 1M kept the 1D candles on screen under the new label until the
    // request returned. A snapshot that no longer matches the current key is
    // simply not read.
    expect(chart).toMatch(/const key = `\$\{coin\.id\}:\$\{days\}`/);
    expect(chart).toMatch(/const data = snap\?\.key === key \? snap : null/);
  });

  it("treats a too-short response as a failure, not as a reason to keep the old chart", () => {
    expect(chart).toMatch(/d\.candles\.length < 2\) throw new Error\("empty"\)/);
  });
});

describe("the detail pages can see their own data", () => {
  for (const [name, src] of [["coin", coin], ["protocol", protocol]] as const) {
    it(`${name}: reads "have we ever loaded" from a ref, not a stale closure`, () => {
      // The effect depended on the id only, so its closure pinned the state
      // value at `null` for the life of the component: `!coin` inside it was
      // always true, which is not what the line says it checks.
      expect(src).toMatch(/const hasData = useRef\(false\)/);
      expect(src).toMatch(/hasData\.current = true/);
      // Both guards - the non-live response and the thrown one.
      expect(src).toMatch(/else if \(!hasData\.current\) \{\s*setFailed\(true\);/);
      expect(src).toMatch(/catch \{\s*if \(!hasData\.current\) setFailed\(true\);/);
      expect(src).not.toMatch(/eslint-disable-next-line react-hooks\/exhaustive-deps/);
    });

    it(`${name}: offers a retry instead of only a page reload`, () => {
      // The next automatic attempt was 150s (coin) / 120s (protocol) away and
      // there was no way to ask for one sooner - the only exit from the error
      // screen was reloading the page.
      expect(src).toMatch(/const \{ refresh \} = useLiveData\(/);
      expect(src).toMatch(/const retry = \(\) => \{[\s\S]{0,120}refresh\(\);/);
      expect(src).toMatch(/onClick=\{retry\}/);
    });

    it(`${name}: does not fall through to a skeleton that never resolves`, () => {
      // Was `if (failed && !p) <error/>` followed by `if (!p) <Skeleton/>`, so
      // finishing with no data and no error animated a skeleton forever.
      expect(src).not.toMatch(/if \(failed && !\w+\)/);
      expect(src).toMatch(/No data for this (coin|protocol) right now\./);
    });
  }
});

describe("dead components do not ship", () => {
  it("EcosystemPills is gone, along with its shim", () => {
    // Zero imports anywhere in src/. It was still compiled, still pulled
    // framer-motion and five lucide icons into a chunk, and still listed in two
    // docs as if it were on the page.
    expect(existsSync("src/modules/markets/components/EcosystemPills.tsx")).toBe(false);
    expect(existsSync("src/components/EcosystemPills.tsx")).toBe(false);
    for (const doc of ["docs/project-state.md", "docs/component-registry.md"]) {
      expect(readFileSync(doc, "utf8")).not.toMatch(/EcosystemPills/);
    }
  });
});
