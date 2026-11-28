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
  it("shows six links: Research moved inside the Academy", () => {
    // 2026-11-20, owner's request. Measured on a production build with every
    // visible header child summed against the nav's inner width (slack =
    // room left over), signed out / signed in:
    //   1280: 42 / 36px   1366: 70 / 64px   1536+: 194 / 64px
    // Bought by (a) rail padding that steps up with the width (px-2, then
    // 2.5 from 1366, 3 from 2xl) and (b) the account button showing only the
    // avatar below 2xl. Before (b), signed in overflowed by 69px at 1440.
    // A NINTH rail link needs re-measuring; this is the record of why.
    // (Measured with eight; Community then moved to "More" to lighten the
    // rail, so the slack below only grew.)
    // 2026-11-25: Research moved inside the Academy (owner), so the rail lost a
    // link and only gained slack.
    expect(railLinks).toHaveLength(6);
    expect(railLinks.map((l) => l.href)).toEqual(["/", "/markets", "/points", "/news", "/academy", "/creators"]);
  });

  it("keeps the width-saving steps that make eight links fit", () => {
    expect(src).toMatch(/px-2 py-2 text-sm font-medium transition-colors min-\[1366px\]:px-2\.5 2xl:px-3/);
    expect(src).toMatch(/hidden flex-col items-start leading-tight 2xl:flex/);
    expect(src).toMatch(/whitespace-nowrap font-display text-\[0\.9375rem\]/);
  });

  it("keeps the secondary destinations out of the rail", () => {
    // ⚠️ The exact list is pinned on purpose. `railLinks` and `moreLinks` are
    // DERIVED from `navLinks`, so a new destination lands in "More" by default -
    // which is right, but it must be a decision someone saw. `/saved` is
    // per-member and belongs here rather than in the rail. `/academy` and
    // `/creators` moved OUT of "More" onto the rail (2026-11-20); `/feedback`
    // joined "More".
    const more = moreLinks.map((l) => l.href).sort();
    expect(more).toEqual(["/community", "/contact", "/feedback", "/premium", "/saved", "/tools"]);
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

describe("the bottom bar keeps Profile centred", () => {
  // Links + the raised Profile button must be an ODD number of cells, so the
  // link count must be EVEN, split evenly either side. It was four; Academy
  // (far left) and Creators (far right) made it six on 2026-11-20. Measured:
  // 46px cells on a 320px phone, every label whole.
  const items = [...bottom.matchAll(/\{ href: "([^"]+)", label: "([^"]+)"/g)].map((m) => ({
    href: m[1],
    label: m[2],
  }));

  it("has six, Academy first and Creators last, in seven columns", () => {
    expect(items).toHaveLength(6);
    expect(items[0].href).toBe("/academy");
    expect(items[items.length - 1].href).toBe("/creators");
    expect(bottom).toMatch(/grid-cols-7/);
    expect(bottom).toMatch(/const half = ITEMS\.length \/ 2;/);
  });

  it("carries Points (Research lives inside the Academy) rather than Tools", () => {
    expect(items.map((i) => i.href)).toContain("/points");
    expect(items.map((i) => i.href)).not.toContain("/research");
    expect(items.map((i) => i.href)).not.toContain("/tools");
  });

  it("every bottom-bar destination is a real nav destination or a signed-in surface", () => {
    // /journal is deliberately not in navLinks - it is signed-in only - so this
    // asserts the weaker, true thing rather than a rule that would fail on it.
    const known = new Set([...navLinks.map((l) => l.href), "/journal"]);
    for (const i of items) expect(known.has(i.href), `${i.href} goes nowhere in the nav`).toBe(true);
  });
});

describe("Points took Premium's place on the rail", () => {
  it("both are in the full list exactly once", () => {
    for (const href of ["/points", "/premium"]) {
      expect(navLinks.filter((l) => l.href === href), href).toHaveLength(1);
    }
    expect(navLinks.find((l) => l.href === "/points")?.label).toBe("Points");
  });

  it("Points is on the rail, Premium is in More", () => {
    expect(railLinks.some((l) => l.href === "/points")).toBe(true);
    expect(moreLinks.some((l) => l.href === "/points")).toBe(false);
    expect(moreLinks.some((l) => l.href === "/premium")).toBe(true);
    expect(railLinks.some((l) => l.href === "/premium")).toBe(false);
  });

  it("was a SWAP when it happened (the rail has since grown, re-measured above)", () => {
    // ⚠️ This is the assertion that matters, given the history at the top of
    // this file: the rail has overflowed twice, both times because a link was
    // ADDED. Points did not join the rail, it replaced Premium - the count is
    // unchanged at six, and "Points" is a character SHORTER than "Premium", so
    // the measured width goes down rather than up. An addition here would need
    // re-measuring; this does not.
    const rail = railLinks.map((l) => l.label).join("");
    expect(rail).not.toMatch(/Premium/);
  });

  it("Premium is still reachable from everywhere it was", () => {
    // It stays in `navLinks`, so the footer and the mobile drawer - which both
    // map the complete list - are unaffected. Only the desktop rail changed.
    expect(navLinks.some((l) => l.href === "/premium")).toBe(true);
  });
});

describe("research lives inside the Academy", () => {
  const read = (p: string) => readFileSync(p, "utf8");
  it("the hub is an Academy tab before Learn, /research redirects, articles keep their URLs", () => {
    const nav = read("src/modules/academy/components/AcademyNav.tsx");
    expect(nav.indexOf('href: "/academy/research"')).toBeGreaterThan(0);
    expect(nav.indexOf('href: "/academy/research"')).toBeLessThan(nav.indexOf('href: "/academy/learn"'));
    expect(read("next.config.mjs")).toMatch(/source: "\/research", destination: "\/academy\/research", permanent: true/);
    expect(navLinks.map((l) => l.href)).not.toContain("/research");
    expect(read("src/app/research/[slug]/page.tsx")).toMatch(/path: "\/academy\/research"/);
    for (const f of ["src/app/api/research/route.ts", "src/app/api/research/[id]/route.ts", "src/app/api/research/[id]/restore/route.ts"]) expect(read(f), f).toMatch(/revalidatePath\("\/academy\/research"\)/);
  });
});
