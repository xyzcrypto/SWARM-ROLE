import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Measured in a browser at 1440px, before this was fixed: the points page drew
// **eight** panels, of which five carried an eyebrow and three did not, and the
// panel titles started at **two different x positions - 125px and 177px**.
//
// The 52px came from the programme sections leading their header row with a
// 40px logo, which pushed the programme name right of every other title on the
// page. Six panels lining up and three not is precisely what reads as "aligned
// nahi hai", and it is not fixable with colour or spacing polish: a ragged left
// edge is the thing being seen.
//
// After: one eyebrow x, one title x, one padding value, at 1440px and 393px.
//
// Real module paths, never the `src/lib` / `src/components` re-export shims left
// by #203 - a shim is one `export * from` line, so a regex against it matches
// nothing and the test passes while checking nothing at all.
const COMPONENTS = "src/modules/points/components";

/** Comments out before matching, so a file documenting the rule it follows
 *  cannot fail on its own explanation. Five other test files here do the same. */
const strip = (s: string) =>
  s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ");

const files = readdirSync(COMPONENTS).filter((f) => f.endsWith(".tsx"));
const sources = Object.fromEntries(
  files.map((f) => [f, strip(readFileSync(join(COMPONENTS, f), "utf8"))])
);

describe("every points panel is built from one header grammar", () => {
  it("found the components (guards against a silently empty read)", () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
    expect(files).toContain("PointsPanel.tsx");
  });

  it("no panel hand-rolls the card chrome any more", () => {
    // `surface rounded-3xl p-5 sm:p-8` repeated in six files is how the padding
    // drifted apart in the first place. One component owns it now.
    const offenders: string[] = [];
    // PointsPanel owns the chrome. ProgramSection is a collapsible panel whose
    // header is a <button>, so it cannot nest inside one. LiveWire is a BAND,
    // not a panel - it has no eyebrow/title/description grammar to share, it
    // sits above the nav rather than in the section list, and forcing it
    // through PointsPanel would give it a heading it should not have.
    const OWNS_ITS_CHROME = new Set(["PointsPanel.tsx", "ProgramSection.tsx", "LiveWire.tsx"]);
    for (const [file, src] of Object.entries(sources)) {
      if (OWNS_ITS_CHROME.has(file)) continue;
      for (const m of src.matchAll(/className="surface[^"]*rounded-3xl[^"]*"/g)) {
        offenders.push(`${file}: ${m[0]}`);
      }
    }
    expect(
      offenders,
      `these draw their own card instead of using <PointsPanel>:\n  ${offenders.join("\n  ")}`
    ).toEqual([]);
  });

  it("hands the gold accent to PointsPanel as its own leaf, not as nested markup", () => {
    // ⚠️ `background-clip: text` does not paint through to nested inline
    // children. A caller wrapping a whole title in `text-shine` renders its
    // other words INVISIBLE - no error, no warning, just missing text. Taking
    // the accent as a separate prop makes that unrepresentable, so the rule is
    // enforced by the component's shape rather than by remembering it.
    const panel = sources["PointsPanel.tsx"];
    expect(panel).toMatch(/accent\?: string/);
    expect(panel).toMatch(/<span className="text-shine">\{accent\}<\/span>/);
  });

  it("gives the programme sections the same left edge as every other panel", () => {
    // The logo belongs with the number on the right, not in front of the title.
    const src = sources["ProgramSection.tsx"];
    const eyebrow = src.indexOf("eyebrow-glass");
    const title = src.indexOf("<h2");
    const logo = src.indexOf("<img");
    expect(eyebrow, "programme sections need the shared eyebrow").toBeGreaterThan(-1);
    expect(title).toBeGreaterThan(eyebrow);
    expect(logo, "the logo must come AFTER the title, or it displaces it").toBeGreaterThan(title);
  });

  it("uses one live-status chip rather than three spellings of one", () => {
    // Three panels each drew their own, with three dot sizes and two greens. A
    // reader reads a status light as one thing or as noise.
    expect(sources["PointsPanel.tsx"]).toMatch(/export function LiveChip/);
    for (const f of ["CompsEngine.tsx", "UpdatesFeed.tsx", "SensitivityGrid.tsx"]) {
      expect(sources[f], `${f} should use <LiveChip>`).toMatch(/<LiveChip/);
    }
  });

  it("stacks the panel header on a phone instead of squeezing the title", () => {
    // ⚠️ `flex-wrap` does NOT solve this and was what shipped. It moves a child
    // to the next line only when it cannot fit AT ITS MINIMUM, and a heading's
    // minimum is one word - so the actions kept the right-hand side and the
    // title was measured at 393px wrapping ONE WORD PER LINE with half the card
    // empty beside it.
    const panel = sources["PointsPanel.tsx"];
    expect(panel).toMatch(/flex-col[^"]*sm:flex-row/);
    expect(panel).not.toMatch(/<header className="flex flex-wrap/);
  });
});

describe("the desk does not occupy the top of the page while empty", () => {
  it("collapses to a single line until something is posted", () => {
    // The full treatment - eyebrow, display heading, description and a bordered
    // box announcing that nothing has happened - was the largest element on the
    // page and said nothing. A reader arriving at a calculator met an empty
    // noticeboard first.
    const src = sources["UpdatesFeed.tsx"];
    expect(src).toMatch(/state === "ready" && updates\.length === 0 && !composing/);
    expect(src).toMatch(/Quiet right now/);
  });

  it("still separates 'nothing posted' from 'feed unreachable'", () => {
    // Collapsing an outage into a quiet desk is a lie in the reader's favour,
    // and the compact state must never swallow the `down` branch.
    const src = sources["UpdatesFeed.tsx"];
    expect(src).toMatch(/state === "ready" && updates\.length === 0/);
    expect(src).toMatch(/not reachable right now/);
  });
});

describe("the wire leads the page with both lanes, distinguishable", () => {
  it("merges the desk and the press into one band", () => {
    // They answer the same question - "what changed today" - and used to sit a
    // full screen apart, the desk at the top and the press feed at the bottom.
    const src = sources["LiveWire.tsx"];
    expect(src).toMatch(/lane: "desk" \| "press"/);
    expect(src).toMatch(/getNewsPage|points\/radar/);
    expect(src).toMatch(/points\/updates/);
  });

  it("never lets a press item pass as the desk's own word", () => {
    // "We are telling you" and "someone reported" are different claims and a
    // farmer acts differently on each, so the lane is never inferred from the
    // wording of a headline.
    const src = sources["LiveWire.tsx"];
    expect(src).toMatch(/function LaneBadge/);
    expect(src).toMatch(/Posted by the XYZ desk/);
    expect(src).toMatch(/Reported by \$\{item\.source\}/);
  });

  it("promotes exactly one item and folds the rest behind a count", () => {
    // A list of twelve equal rows has no answer to "what matters right now".
    const src = sources["LiveWire.tsx"];
    expect(src).toMatch(/const \[hot, \.\.\.rest\] = items/);
    expect(src).toMatch(/\$\{rest\.length\} more/);
  });

  it("ranks a pinned desk post above everything", () => {
    expect(sources["LiveWire.tsx"]).toMatch(/if \(a\.pinned !== b\.pinned\)/);
  });
});

describe("the comparables panel shows live data even when nothing derives", () => {
  it("renders the venue tape independently of the comparable set", () => {
    // Everything else in that panel needs a peer with BOTH volume and an FDV.
    // When no peer matches, all of it collapsed and the panel went blank while
    // holding forty venues of live volume. "Live" that disappears whenever the
    // derived number cannot be computed is not live.
    const src = sources["CompsEngine.tsx"];
    expect(src).toMatch(/function VenueTape/);
    expect(src).toMatch(/byVolume\.length > 0 && <VenueTape/);
    // Outside the `venues.length > 0 && (...)` comparable block, so it cannot be
    // taken down by an empty comparable set.
    expect(src.indexOf("<VenueTape")).toBeGreaterThan(src.indexOf("comps.length > 0 && <CompsTable"));
  });

  it("names which half of the data is missing", () => {
    // A column of dashes reads as zero. Volumes live + valuations absent is a
    // specific, explainable state and it should say so.
    expect(sources["CompsEngine.tsx"]).toMatch(/priced === 0/);
  });
});
