import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Clicking "Home" from another page landed the reader at the BOTTOM of the
// homepage. Measured on a production build at 1280x900, clicking the header
// link, before this component existed:
//
//     /research -> /     0px -> 8171px    (the page is 9146px tall)
//     /news     -> /     0px -> 8246px
//
// and after:
//
//     /research -> /     0px -> 9px
//     /news     -> /     0px -> 9px
//
// The cause was two systems both moving the scroll. Hooking `scrollIntoView`
// before app code ran showed the App Router calling it once per top-level
// element of the incoming page - and because the first and last of those are
// `position: fixed` (the mobile bottom bar and the header), which are always
// "in view" and therefore no-ops, what it effectively did was scroll to the
// <footer>. Lenis latched that as its target and eased down to it over its
// 1.15s duration, arriving last and therefore winning.
//
// Real source paths on purpose: `src/components/*` and `src/lib/*` are
// re-export shims after #203, so reading one matches nothing and passes while
// verifying nothing.
const route = readFileSync("src/shared/components/RouteTopScroll.tsx", "utf8");
const lock = readFileSync("src/shared/hooks/useScrollLock.ts", "utf8");
const smooth = readFileSync("src/shared/components/SmoothScroll.tsx", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

describe("a cross-route navigation lands at the top", () => {
  it("is mounted in the root layout", () => {
    expect(strip(layout)).toContain("<RouteTopScroll />");
  });

  it("moves the native scroll AND the smooth-scroll engine together", () => {
    // Half a fix is no fix: Lenis holds its own target and rewrites the scroll
    // on its next rAF tick, so a native `scrollTo` it did not initiate is
    // undone a frame later. That is what the bug was made of.
    expect(strip(lock)).toMatch(/export function scrollPageToTop[\s\S]{0,240}window\.scrollTo\(0, 0\)/);
    expect(strip(lock)).toMatch(/export function scrollPageToTop[\s\S]{0,240}smooth\?\.toTop\(\)/);
    expect(strip(smooth)).toMatch(/toTop:\s*\(\)\s*=>\s*lenis\.scrollTo\(0,\s*\{[^}]*immediate:\s*true/);
    expect(strip(route)).toContain("scrollPageToTop");
  });

  it("runs after the router, not with it", () => {
    // The router's own `scrollIntoView` calls land on the frame after paint and
    // Lenis's tick after that, so a single frame lands in the middle of the
    // sequence and gets overwritten. Two nested frames put this last.
    const body = strip(route);
    expect(body).toMatch(/requestAnimationFrame\([\s\S]{0,160}requestAnimationFrame\(/);
    // and it must clean up, or a fast route change leaves a frame armed against
    // a page that has already gone.
    expect(body).toContain("cancelAnimationFrame");
  });

  it("leaves back/forward alone", () => {
    // A reader returning to a list expects to come back where they were. This
    // is also what keeps the component out of the way of real scroll
    // restoration if that is added later.
    const body = strip(route);
    expect(body).toContain("popstate");
    expect(body).toMatch(/popped\.current\s*=\s*false;?\s*\n?\s*return/);
  });

  it("leaves hash links to HashScroll", () => {
    expect(strip(route)).toMatch(/window\.location\.hash[\s\S]{0,40}return/);
  });

  it("does not call useSearchParams", () => {
    // Called from the root layout it opts every page under it out of static
    // rendering unless each is wrapped in its own Suspense boundary. The route
    // table is the check that would catch a regression here, but it is worth
    // failing in unit tests first - a static-to-dynamic flip is the most
    // expensive regression class on this project.
    expect(strip(route)).not.toContain("useSearchParams");
  });

  it("does not duplicate SameRouteTopScroll", () => {
    // The two cover different halves and neither covers the other's: this one
    // fires on a pathname change, that one on a click whose href is the page
    // you are already on (where there is no navigation and no pathname change).
    expect(strip(layout)).toContain("<SameRouteTopScroll />");
    const same = readFileSync("src/shared/components/SameRouteTopScroll.tsx", "utf8");
    expect(strip(same)).not.toContain("usePathname");
    expect(strip(route)).toContain("usePathname");
  });
});
