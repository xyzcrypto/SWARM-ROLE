import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";

// `/logo.png` is a 512x512 RGBA master weighing ~338 KB. Behind `next/image`
// that is exactly right - Next emits a 4-18 KB WebP per size and the master is
// the quality source it optimises from. In a raw `href` or `src` it is a
// disaster, because the browser fetches all 338 KB whatever box it is painting
// into.
//
// Both raw uses were live at once and neither was obvious:
//
//   metadata.icons.icon  -> the FAVICON. 338 KB on every page load, every
//                           browser, to paint 16x16. Invisible in a network
//                           panel because a favicon request has no JS
//                           initiator: it shows as "other" with no stack,
//                           which reads like a service-worker fetch.
//   sw.js PRECACHE       -> downloaded by every first-time visitor at `install`,
//                           whether or not they ever went offline, so that
//                           /offline.html could fill an 84px box.
//
// Measured on the homepage: 2677 KB -> 2321 KB for a first visit.
//
// Real source paths on purpose - `src/components/*` and `src/lib/*` are
// re-export shims after #203, so reading one matches nothing and passes while
// verifying nothing.
const layout = readFileSync("src/app/layout.tsx", "utf8");
const sw = readFileSync("public/sw.js", "utf8");
const offline = readFileSync("public/offline.html", "utf8");

const strip = (s: string) =>
  s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ").replace(/<!--[\s\S]*?-->/g, " ");

const kb = (p: string) => statSync(p).size / 1024;

describe("the logo master never reaches a browser as a raw file", () => {
  it("the favicon is a favicon-sized asset", () => {
    const icons = /icons:\s*\{[\s\S]*?\n  \}/.exec(strip(layout))?.[0] ?? "";
    expect(icons, "no `icons` block found in layout metadata").not.toBe("");
    expect(icons).not.toContain("/logo.png");
    expect(icons).toContain("/icon-32.png");
    expect(kb("public/icon-32.png")).toBeLessThan(10);
    expect(kb("public/icon-192.png")).toBeLessThan(40);
  });

  it("the service worker precaches nothing heavy", () => {
    const precache = /const PRECACHE\s*=\s*\[[^\]]*\]/.exec(strip(sw))?.[0] ?? "";
    expect(precache, "no PRECACHE list found in sw.js").not.toBe("");
    expect(precache).not.toContain("/logo.png");
    // Everything in this list is downloaded by everyone on their first visit,
    // so the budget is deliberately tight rather than merely "smaller than it
    // was". Adding to it is a decision, not a detail.
    for (const url of precache.match(/"\/[^"]+"/g) ?? []) {
      const path = "public" + url.slice(1, -1);
      expect(kb(path), `${path} is precached and too heavy`).toBeLessThan(40);
    }
  });

  it("the offline page shows the small logo, not the master", () => {
    // This page renders with no server and no framework, so it cannot use
    // next/image and has to name a right-sized file itself.
    expect(strip(offline)).not.toContain("/logo.png");
    expect(strip(offline)).toContain("/logo-offline.webp");
  });

  it("the master itself is still the high-quality source next/image needs", () => {
    // The fix is never "shrink the master" - a smaller source means worse
    // optimised output at every size the site actually renders.
    expect(kb("public/logo.png")).toBeGreaterThan(100);
  });
});

describe("the lite motion tier reaches the hero medallion", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const hero = readFileSync("src/components/Hero.tsx", "utf8");

  it("swaps the medallion glow's blur for a gradient", () => {
    // `blur-3xl` is a 64px Gaussian over a disc that is simultaneously pulsing
    // and being tilted by the parallax spring, so it is re-rasterised rather
    // than recomposited. Worth 4.6 fps at 390x844 / 6x CPU.
    expect(css).toMatch(/html\.lite-motion\s+\.hero-glow\s*\{[^}]*filter:\s*none/);
    expect(hero).toContain("hero-glow");
  });

  it("stops the badge loops through the hook, not through CSS", () => {
    // framer-motion drives `animate` from its own rAF, so it appears in
    // neither `document.getAnimations()` nor `animation-play-state` - both
    // `PauseOffscreenAnimations` and the `html.lite-motion` block are blind to
    // it. Worth 4.1 fps across the seven badges.
    expect(hero).toContain("useLiteMotion");
    expect(hero).toMatch(/animate=\{lite \? undefined :/);
  });

  it("gates the animation and not the markup", () => {
    // Server and hydration both read `lite === false`, so anything that
    // changed the rendered HTML would flip on the render after hydration -
    // the React #418 trap in a new coat. An absent `animate` adds and removes
    // no attribute; a conditional element or gesture prop would.
    expect(hero).not.toMatch(/\{lite && </);
    expect(hero).not.toMatch(/lite \? null :/);
    expect(hero).not.toMatch(/while(Tap|Hover)=\{lite/);
  });
});
