import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Where the page sits after a navigation. Two halves, opposite answers, and
// each was broken in its own way.
//
// FORWARD (a link click) should land at the top. It landed at the BOTTOM.
// Measured on a production build at 1280x900, clicking the header "Home":
//
//     /research -> /   0px -> 8171px   (the page is 9146px tall)   -> 9px
//     /news     -> /   0px -> 8246px                               -> 9px
//
// and not as a jump - a ~1s animation gliding downward. Hooking
// `scrollIntoView` before app code ran caught the App Router calling it once
// per top-level element of the incoming page; the first and last of those are
// `position: fixed` and therefore no-ops, so what it effectively did was scroll
// to the <footer>. Lenis latched that as its target and eased down to it,
// arriving last. Last writer wins.
//
// BACK should return you where you were. It restored NOTHING, anywhere:
//
//     history.scrollRestoration = "manual"      (set in SmoothScroll)
//     / @4000px -> /about -> BACK -> @0px
//
// That flag is right for a fresh load - it stops a page reopening part-way
// down - but nothing replaced the back/forward restoration it also switched
// off. Going back from an article to a list dumped the reader at the top of
// the list, on every page of the site.
//
// Real source paths on purpose: `src/components/*` and `src/lib/*` are
// re-export shims after #203, so reading one matches nothing and passes while
// verifying nothing.
const route = readFileSync("src/shared/components/RouteScroll.tsx", "utf8");
const lock = readFileSync("src/shared/hooks/useScrollLock.ts", "utf8");
const smooth = readFileSync("src/shared/components/SmoothScroll.tsx", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const strip = (s: string) => s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ");
const R = strip(route);

describe("a forward navigation lands at the top", () => {
  it("is mounted in the root layout", () => {
    expect(strip(layout)).toContain("<RouteScroll />");
  });

  it("moves the native scroll (and any registered engine) together", () => {
    // Lenis was removed (scroll now runs on the compositor thread, see
    // SmoothScroll.tsx), but the helper still moves both halves so that a
    // future engine cannot reintroduce the forward-navigation bug.
    expect(strip(lock)).toMatch(/export function scrollPageTo\(y: number\)[\s\S]{0,240}window\.scrollTo\(0, y\)/);
    expect(strip(lock)).toMatch(/export function scrollPageTo\(y: number\)[\s\S]{0,240}smooth\?\.toOffset\(y\)/);
  });

  it("does not drive the page scroll from JavaScript", () => {
    // A JS scroller (Lenis) puts every scroll frame on the main thread, which
    // is what made the site lag on desktop. Native scrolling only.
    expect(strip(smooth)).not.toMatch(/from "lenis"|new Lenis\(/);
    expect(strip(smooth)).not.toContain("requestAnimationFrame");
  });

  it("runs after the router, not with it", () => {
    // The router's `scrollIntoView` walk lands on the frame after paint and
    // Lenis's tick after that; one frame lands mid-sequence and is overwritten.
    expect(R).toMatch(/requestAnimationFrame\([\s\S]{0,220}requestAnimationFrame\(/);
    expect(R).toContain("cancelAnimationFrame");
  });

  it("does not call useSearchParams", () => {
    // From the root layout it opts every page under it out of static rendering
    // unless each is wrapped in its own Suspense boundary. A static-to-dynamic
    // flip is the most expensive regression class on this project, so this
    // fails in unit tests before the route table has to catch it.
    expect(R).not.toContain("useSearchParams");
  });

  it("does not duplicate SameRouteTopScroll", () => {
    // The two cover different halves and neither covers the other's: this one
    // fires on a pathname change, that one on a click whose href is the page
    // you are already on - where there is no navigation and no pathname change.
    expect(strip(layout)).toContain("<SameRouteTopScroll />");
    const same = readFileSync("src/shared/components/SameRouteTopScroll.tsx", "utf8");
    expect(strip(same)).not.toContain("usePathname");
    expect(R).toContain("usePathname");
  });
});

describe("back and forward return you where you were", () => {
  it("records the offset as you scroll", () => {
    expect(R).toMatch(/addEventListener\("scroll", onScroll, \{ passive: true \}\)/);
    expect(R).toMatch(/positions\.set\(urlKey\(\), window\.scrollY\)/);
  });

  it("coalesces those writes to one per frame", () => {
    // This fires on every scroll event on every page of the site, so it has to
    // cost nothing.
    const fn = /const onScroll = \(\) => \{[\s\S]*?\n    \};/.exec(R)?.[0] ?? "";
    expect(fn).not.toBe("");
    expect(fn).toContain("requestAnimationFrame");
    expect(fn).toMatch(/if \(navigating \|\| queued\) return;/);
  });

  it("restores only on a pop, and tops out otherwise", () => {
    expect(R).toMatch(/const target = wasPop \? positions\.get\(urlKey\(\)\) : undefined/);
    expect(R).toMatch(/if \(target === undefined\) scrollPageToTop\(\);\s*else scrollPageTo\(target\);/);
  });

  it("re-applies for the whole budget rather than stopping when it lands", () => {
    // Two reasons. The saved offset is often not reachable yet (the list is
    // still streaming in, so the document is shorter than the target). And the
    // router's own scrollIntoView walk runs AFTER: an early return on success
    // handed the page straight back to it and produced @8246px, the footer,
    // which is the very symptom this was written to fix.
    expect(R).toMatch(/scrollPageTo\(target\)/);
    const step = /const step = \(\) => \{[\s\S]*?\n    \};/.exec(R)?.[0] ?? "";
    expect(step).not.toBe("");
    expect(step, "step returns early on success and loses to the router").not.toMatch(/<= RESTORE_EPSILON\) return/);
  });

  it("does not record the router's own scroll churn as the reader's position", () => {
    // The bug this caused: reader at 4000 clicks a link, the router drags the
    // OUTGOING page to its footer at 8246, and the recorder - still keyed on
    // that url - saved 8246. Back then "restored" the footer. Measured.
    expect(R).toMatch(/if \(navigating \|\| queued\) return;/);
    expect(R).toMatch(/if \(!navigating\) positions\.set\(urlKey\(\), window\.scrollY\)/);
    // Frozen at the click - before any of that churn - not at the pathname
    // change, which happens after it.
    expect(R).toMatch(/document\.addEventListener\("click", onClick, true\)/);
  });

  it("always thaws, even when a click does not navigate", () => {
    // `href="#"`, a late preventDefault, or a link to the page you are already
    // on all freeze without ever producing a settle. Without the timer the
    // recorder would be dead for the rest of the session and the next Back
    // would restore a position from minutes ago.
    expect(R).toMatch(/function freeze\(\)[\s\S]{0,200}setTimeout\(/);
    expect(R).toMatch(/function thaw\(\)[\s\S]{0,120}clearTimeout\(thawTimer\)/);
  });

  it("gives up rather than fighting the reader", () => {
    // An unbounded retry would drag the page back every frame if the reader
    // scrolls during it.
    const max = Number(/RESTORE_MAX_FRAMES = (\d+)/.exec(R)?.[1]);
    expect(max).toBeGreaterThan(0);
    expect(max).toBeLessThanOrEqual(60);
    expect(R).toMatch(/if \(\+\+frames >= RESTORE_MAX_FRAMES\) \{/);
  });

  it("leaves hash links to HashScroll in both directions", () => {
    expect(R).toMatch(/window\.location\.hash[\s\S]{0,80}return/);
  });

  it("keeps positions in memory, not in storage", () => {
    // A position restored after a reload would be restoring into a page whose
    // content may be completely different.
    expect(R).toContain("new Map<string, number>()");
    expect(R).not.toContain("sessionStorage");
    expect(R).not.toContain("localStorage");
  });
});
