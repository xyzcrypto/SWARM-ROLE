import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// "Mere wale me kuch UX work nahi karta - product ka layout wala, aur hero page
// ka teesre wale me mouse pointer se kuch nahi hota. Mobile me bhi product wala
// layout ka animation nahi hai."
//
// Two separate causes, both of which make the site behave differently from one
// device to the next for reasons nothing on the page explains.
const strip = (s: string) => s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ");
const read = (p: string) => strip(readFileSync(p, "utf8"));
const hero = read("src/components/Hero.tsx");
const css = readFileSync("src/app/globals.css", "utf8");

const HOVER_SCALE_FILES = [
  "src/components/Products.tsx",
  "src/components/About.tsx",
  "src/components/OrbitalEcosystem.tsx",
  "src/modules/profile/components/ProfileStats.tsx",
  "src/app/u/[username]/page.tsx",
];

/** Every .tsx under src/, real paths - `src/components/*` are re-export shims. */
function allTsx(dir = "src", acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) allTsx(p, acc);
    else if (p.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

describe("the hero medallion tilts for everyone with a mouse", () => {
  it("no longer bails out under the OS reduced-motion preference", () => {
    // `onMove` opened with an early return on
    // `matchMedia("(prefers-reduced-motion: reduce)").matches`, so the 3D tilt
    // was simply dead on any machine with that setting on - and there is
    // nothing on the page to tell you why your desktop behaves differently
    // from someone else's.
    expect(hero).not.toMatch(/prefers-reduced-motion: reduce"\)\.matches\) return/);
  });

  it("still throttles to one update per frame", () => {
    // The reason this function is careful in the first place: a 120Hz mouse
    // fires mousemove faster than the eye can use.
    expect(hero).toMatch(/if \(moveRaf\.current\) return;/);
    expect(hero).toMatch(/requestAnimationFrame\(/);
  });
});

describe("touch gets the same feedback a mouse gets", () => {
  it("every hover-only icon scale has a press equivalent", () => {
    // `group-hover:` never fires on a touch screen, so on a phone these icons
    // did not move at all - the cards looked completely inert next to the same
    // cards on a laptop.
    for (const f of HOVER_SCALE_FILES) {
      const src = readFileSync(f, "utf8");
      const hovers = src.match(/group-hover:scale-110/g)?.length ?? 0;
      const actives = src.match(/group-active:scale-110/g)?.length ?? 0;
      expect(actives, `${f} has ${hovers} hover scales but ${actives} press ones`).toBe(hovers);
    }
  });

  it("the product-card arrow nudges on press too", () => {
    const src = readFileSync("src/components/Products.tsx", "utf8");
    expect(src).toMatch(/group-active:-translate-y-0\.5 group-active:translate-x-0\.5 group-active:text-gold-200/);
  });

  it("the card highlight is reachable by touch", () => {
    // `.surface-hover` carried the gold border and lit background that say
    // "this is the one you picked". Hover-only meant a phone never saw it.
    expect(css).toMatch(/\.surface-hover:active \{\s*border-color: rgba\(226, 167, 47, 0\.35\);/);
  });
});

describe("every meaningful hover has a press equivalent, everywhere", () => {
  // The first pass at this covered `scale-110` and nothing else, which is why
  // a browser audit still found fourteen live hover-only effects: the nav
  // underline, the hero CTA lift, the social-icon hop, the research card's
  // shine sweep, the orbital tooltip. All dead on a phone.
  //
  // Only transform and opacity are policed. A colour-only hover is decoration
  // a finger does not miss; something that MOVES or APPEARS is the page saying
  // "this is the one you picked", and that has to reach touch too.
  const MEANINGFUL = ["-translate-y-0.5", "translate-x-0.5", "scale-110", "scale-105", "scale-x-100", "translate-x-full"];

  it("has no bare hover transform left without an active twin", () => {
    const orphans: string[] = [];
    for (const file of allTsx()) {
      const src = readFileSync(file, "utf8");
      for (const util of MEANINGFUL) {
        for (const g of ["", "group-"]) {
          const hover = `${g}hover:${util}`;
          const active = `${g}active:${util}`;
          // Token boundary on the left, so a responsive `sm:group-hover:` - which
          // carries its own deliberate breakpoint intent - is not counted here.
          const re = new RegExp(`(^|[\\s"'\`{])${hover.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[\\s"'\`}])`, "g");
          for (const m of src.matchAll(re)) {
            const near = src.slice(Math.max(0, m.index! - 400), m.index! + 400);
            if (!near.includes(active)) orphans.push(`${file}: ${hover}`);
          }
        }
      }
    }
    expect(orphans, `hover-only, dead on touch:\n  ${orphans.join("\n  ")}`).toEqual([]);
  });
});

describe("a hover cannot hide a feature from a phone", () => {
  it("the conversation options button is visible without a hover", () => {
    // Pin and remove live behind this button, and it was `opacity-0` revealed
    // only by `group-hover:`. On a phone nothing hovers, so the control was
    // invisible - the feature did not exist on touch at all. This is the one
    // genuine reachability gap the audit found, and the reason the Tailwind
    // hover flag below could not simply be switched on by itself.
    const src = readFileSync("src/modules/messages/components/MessagesClient.tsx", "utf8");
    // The whole class run, so the assertion cannot pass on some other button:
    // visible by default, hidden and hover-revealed only from `sm` up.
    expect(src).toMatch(
      /grid h-7 w-7 place-items-center rounded-full text-zinc-600 opacity-100 transition-opacity[^"]*sm:opacity-0 sm:group-hover:opacity-100/
    );
    // And the old shape must be gone, not merely outnumbered.
    expect(src).not.toMatch(/text-zinc-600 opacity-0 transition-opacity[^"]*group-hover:opacity-100/);
  });

  it("the orbital node's description reaches a finger", () => {
    // It was in the `aria-label` (so a screen reader had it) and in a
    // hover-only tooltip (so a mouse had it). Touch had neither.
    const src = readFileSync("src/components/OrbitalEcosystem.tsx", "utf8");
    expect(src).toMatch(/group-hover:opacity-100 group-active:opacity-100/);
  });
});

describe("a tapped card does not stay stuck looking hovered", () => {
  it("scopes EVERY Tailwind hover utility to devices that hover", () => {
    // globals.css hand-scoped `.surface-hover` and `.lift`, and that was the
    // whole of it - the built CSS contained exactly one `@media (hover: hover)`
    // while ~200 Tailwind `hover:` utilities sat outside it. So a tap left the
    // card lifted and lit until you tapped elsewhere, which reads as a
    // rendering glitch rather than a hover state.
    //
    // This flag is only safe BECAUSE of the two describes above: it removes
    // hover feedback from touch entirely, so the press twins have to exist
    // first and no `hover:` may be the only way to reach something.
    const config = readFileSync("tailwind.config.ts", "utf8");
    expect(config).toMatch(/future:\s*\{[\s\S]*?hoverOnlyWhenSupported:\s*true/);
  });

  it("scopes the hand-written hover rules too", () => {
    // Without this, mobile browsers leave `:hover` applied after a tap, so one
    // card sits lit up and lifted until you tap somewhere else - which reads as
    // a rendering bug rather than a hover state.
    expect(css).toMatch(/@media \(hover: hover\) \{\s*\.surface-hover:hover \{/);
    expect(css).toMatch(/@media \(hover: hover\) \{\s*\.lift:hover \{/);
  });

  it("keeps the press state outside the media query", () => {
    // `:active` is the touch path - gating it on `hover: hover` would undo the
    // whole point.
    const activeAt = css.indexOf(".surface-hover:active");
    const mediaAt = css.indexOf("@media (hover: hover)");
    expect(activeAt).toBeGreaterThan(mediaAt);
    expect(css).toMatch(/\.lift:active \{/);
  });
});
