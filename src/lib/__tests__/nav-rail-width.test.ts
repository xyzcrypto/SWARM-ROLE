import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { navLinks, railLinks, moreLinks } from "@shared/utils/site";

// The desktop nav rail has overflowed its breakpoint TWICE, both times because
// a link was added and nobody re-measured:
//
//   at `md` (768): rail needed 1025px  -> iPad portrait overflowed by 257px
//   at `lg` (1024): rail needed 1071px -> iPad landscape overflowed by 60px
//
// The second was Points arriving as a ninth link, and the fix was moving the
// rail to `xl`. Moving Points, Tools and Contact into a "More" dropdown then
// took the rail down to six links and 684px.
//
// ⚠️ THE BREAKPOINT DID NOT MOVE BACK. Simulating the `lg` layout at 1024 with
// the shorter rail, the nav's children summed to 990px against 998px available
// - it fits by EIGHT PIXELS, measured while signed out, and a signed-in header
// is wider still (avatar plus membership label). Eight pixels of margin is what
// "it fits" looked like both times this broke. It stays at xl.
const NAVBAR = "src/shared/components/Navbar.tsx"; // real path - src/components/* is a shim
const BOTTOM = "src/shared/components/BottomNav.tsx";
const src = readFileSync(NAVBAR, "utf8");
const bottom = readFileSync(BOTTOM, "utf8");

describe("nothing can fall out of the navigation", () => {
  // The partition is derived in site.ts rather than hand-written precisely so
  // this cannot happen - but the derivation is one filter away from being
  // edited into two literal arrays, and then a link belongs to neither.
  it("every link is in exactly one of rail or more", () => {
    const partition = [...railLinks, ...moreLinks].map((l) => l.href).sort();
    expect(partition).toEqual(navLinks.map((l) => l.href).sort());
  });

  it("rail and more never overlap", () => {
    const railHrefs = new Set(railLinks.map((l) => l.href));
    expect(moreLinks.filter((l) => railHrefs.has(l.href))).toEqual([]);
  });

  it("the footer and the mobile drawer still render the COMPLETE list", () => {
    // Both map `navLinks`, so shrinking that array - rather than partitioning
    // it - would have made Points, Tools and Contact unreachable on a phone
    // entirely. The rail renders `railLinks`; only the rail.
    expect(src).toMatch(/\{railLinks\.map/);
    expect(src).toMatch(/\{navLinks\.map/);
    expect([...src.matchAll(/navLinks\.map/g)]).toHaveLength(1); // the drawer
    const footer = readFileSync("src/shared/components/Footer.tsx", "utf8");
    expect(footer).toMatch(/navLinks\.map/);
  });
});

describe("the desktop rail fits the links it has", () => {
  it("shows six links, measured at 684px", () => {
    expect(railLinks).toHaveLength(6);
  });

  it("keeps the secondary destinations out of the rail", () => {
    // ⚠️ The exact list is pinned on purpose. `railLinks` and `moreLinks` are
    // DERIVED from `navLinks`, so a new destination lands in "More" by default -
    // which is right, but it must be a decision someone saw. `/saved` is
    // per-member and belongs here rather than in the six-link rail, which is
    // already eight pixels from overflowing at its breakpoint.
    const more = moreLinks.map((l) => l.href).sort();
    expect(more).toEqual(["/contact", "/points", "/saved", "/tools"]);
  });

  it("still appears only from xl, for the eight-pixel reason above", () => {
    expect(src).toMatch(/hidden items-center gap-0\.5 xl:flex/);
    expect(src).not.toMatch(/hidden items-center gap-0\.5 lg:flex/);
  });

  it("moves the right-hand controls and the menu button with it", () => {
    // Half a migration leaves 1024-1279 with no navigation at all.
    expect(src).toMatch(/hidden items-center gap-2 xl:flex/);
    expect(src).toMatch(/flex items-center xl:hidden/);
  });

  it("closes the More dropdown on outside click and Escape", () => {
    // Same contract as the account dropdown beside it. A menu that only closes
    // by re-clicking its own trigger is the kind of thing that ships.
    expect(src).toMatch(/moreRef\.current && !moreRef\.current\.contains/);
    expect(src).toMatch(/e\.key === "Escape" && setMore\(false\)/);
  });
});

describe("the bottom bar stays four links, so Profile stays centred", () => {
  // Four links plus the raised Profile button is five cells. A fifth link makes
  // it cell 3 of 6 - visibly left of centre - which is why this list only ever
  // changes by swapping.
  const items = [...bottom.matchAll(/\{ href: "([^"]+)", label: "([^"]+)"/g)].map((m) => ({
    href: m[1],
    label: m[2],
  }));

  it("has exactly four", () => {
    expect(items).toHaveLength(4);
  });

  it("carries Research rather than Tools", () => {
    expect(items.map((i) => i.href)).toContain("/research");
    expect(items.map((i) => i.href)).not.toContain("/tools");
  });

  it("every bottom-bar destination is a real nav destination or a signed-in surface", () => {
    // /journal is deliberately not in navLinks - it is signed-in only - so this
    // asserts the weaker, true thing rather than a rule that would fail on it.
    const known = new Set([...navLinks.map((l) => l.href), "/journal"]);
    for (const i of items) expect(known.has(i.href), `${i.href} goes nowhere in the nav`).toBe(true);
  });
});

describe("Points is still reachable", () => {
  it("is in the full list exactly once", () => {
    const hits = navLinks.filter((l) => l.href === "/points");
    expect(hits).toHaveLength(1);
    expect(hits[0].label).toBe("Points");
  });

  it("is in More, not the rail", () => {
    expect(moreLinks.some((l) => l.href === "/points")).toBe(true);
    expect(railLinks.some((l) => l.href === "/points")).toBe(false);
  });
});
