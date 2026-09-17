import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { navLinks } from "@shared/utils/site";

// The desktop nav rail has now overflowed its breakpoint TWICE, both times
// because a link was added and nobody re-measured:
//
//   at `md` (768): rail needed 1025px  -> iPad portrait overflowed by 257px
//   at `lg` (1024): rail needed 1071px -> iPad landscape overflowed by 60px
//
// The second one was this PR adding Points as a ninth link. The fix each time
// was to move the rail up a breakpoint, and each time the previous fix's
// headroom (per-link padding) had already been spent.
//
// A unit test cannot measure rendered width, so it guards the thing it can:
// the link count the current breakpoint was measured at. Add a tenth link and
// this fails, which is the prompt to go and measure again rather than to bump
// the number.
const NAVBAR = "src/shared/components/Navbar.tsx"; // real path - src/components/* is a shim
const src = readFileSync(NAVBAR, "utf8");

/** Measured at 1280px with 9 links: rail 820px, no overhang. */
const MEASURED_AT = 9;

describe("the desktop nav rail fits the links it has", () => {
  it(`has no more links than the ${MEASURED_AT} the breakpoint was measured at`, () => {
    expect(
      navLinks.length,
      `navLinks is now ${navLinks.length}. The rail's xl breakpoint was measured with ${MEASURED_AT} ` +
        "links (820px wide at 1280px viewport, no overhang). Re-measure at 1280 and 1024 before raising this."
    ).toBeLessThanOrEqual(MEASURED_AT);
  });

  it("shows the rail from xl, not lg", () => {
    // At lg (1024) nine links need 1071px against 998px of usable width.
    expect(src).toMatch(/hidden items-center gap-0\.5 xl:flex/);
    expect(src).not.toMatch(/hidden items-center gap-0\.5 lg:flex/);
  });

  it("moves the right-hand controls and the menu button with it", () => {
    // Half a migration is worse than none: the rail hidden at lg while the
    // hamburger is also hidden leaves 1024-1279 with no navigation at all.
    expect(src).toMatch(/hidden items-center gap-2 xl:flex/);
    expect(src).toMatch(/flex items-center xl:hidden/);
  });

  it("keeps every link reachable below the breakpoint", () => {
    // The mobile panel maps the same array, so nothing is dropped - the rail
    // just stops being the way you reach it.
    expect(src).toMatch(/navLinks\.map/g);
    expect([...src.matchAll(/navLinks\.map/g)]).toHaveLength(2);
  });
});

describe("Points is in the navigation", () => {
  it("appears once, pointing at /points", () => {
    const hits = navLinks.filter((l) => l.href === "/points");
    expect(hits).toHaveLength(1);
    expect(hits[0].label).toBe("Points");
  });

  it("sits next to Markets rather than at the end", () => {
    // It is a markets-adjacent research surface, not an afterthought like
    // Contact. Order is the only signal a nav gives about what matters.
    const i = navLinks.findIndex((l) => l.href === "/points");
    const m = navLinks.findIndex((l) => l.href === "/markets");
    expect(i).toBe(m + 1);
  });
});
