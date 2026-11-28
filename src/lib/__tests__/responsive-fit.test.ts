import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import fg from "fast-glob";

const read = (p: string) => readFileSync(p, "utf8");
const sources = fg.sync("src/**/*.{ts,tsx}", { ignore: ["src/**/__tests__/**"] });

// Every page has to fit every screen, from a 320px phone to a 4K TV
// (2026-11-28 audit: 41 pages x 11 viewports).

describe("big screens: the UI scales with the screen", () => {
  const css = read("src/app/globals.css");

  it("the root font size grows from 1920px (gently to 2560, to 2x at 3840)", () => {
    expect(css).toMatch(/@media \(min-width: 1920px\) \{\s*html \{ font-size: calc\(var\(--ui-scale\) \* \(100% \+ \(100vw - 1920px\) \* 0\.00375\)\); \}/);
    expect(css).toMatch(/@media \(min-width: 2560px\) \{\s*html \{ font-size: calc\(var\(--ui-scale\) \* min\(400%, 115% \+ \(100vw - 2560px\) \* 0\.010625\)\); \}/);
    // 1920 -> 100%, 2560 -> 115%, 3840 -> 200%.
    expect(100 + (2560 - 1920) * 0.00375 * (100 / 16)).toBeCloseTo(115, 5);
    expect(115 + (3840 - 2560) * 0.010625 * (100 / 16)).toBeCloseTo(200, 5);
  });

  it("not CSS zoom, which doubles every 100vh/100vw element", () => {
    expect(css).not.toMatch(/html \{[^}]*\bzoom:/);
  });

  // A px size does not grow with the root, so a 4K screen would show it at half
  // the size of everything around it. Hairlines (<= 2px) are meant to stay thin.
  it("no size utility is written in px (borders, rings, blurs and hairlines excepted)", () => {
    const util = /(?<![\w[-])-?(?:text|w|h|max-w|min-w|min-h|max-h|gap|gap-x|gap-y|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|left|top|right|bottom|inset|leading|size|basis|grid-cols|grid-rows|scroll-mt)-\[([^\]\s"'`]*?)\]/g;
    const offenders: string[] = [];
    for (const f of sources) {
      for (const m of read(f).matchAll(util)) {
        const pxs = [...m[1].matchAll(/(?<![\d.])(\d+(?:\.\d+)?)px/g)].map((x) => Number(x[1]));
        if (pxs.some((n) => n > 2)) offenders.push(`${f}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the container token is rem too", () => {
    expect(read("tailwind.config.ts")).toMatch(/container: "75rem",/);
  });

  it("the reader's text size composes with the screen scale instead of replacing it", () => {
    expect(css).toMatch(/html\.text-scale-110 \{ --ui-scale: 1\.1; \}/);
    expect(css).not.toMatch(/html\.text-scale-\d+ \{ font-size:/);
  });
});

describe("phones: nothing is pushed off the screen", () => {
  // A grid with only responsive columns (`grid sm:grid-cols-2`) has an implicit
  // `auto` column below that breakpoint, which grows to its widest content. On
  // /news that made the top story 363px wide on a 320px phone, cutting off its
  // bookmark button. `grid-cols-1` is minmax(0,1fr): it can never exceed the screen.
  it("every responsive grid declares its base column", () => {
    const cls = /className=(?:"([^"]*)"|\{`([^`]*)`\}|\{cn\(\s*"([^"]*)")/g;
    const offenders: string[] = [];
    for (const f of sources.filter((s) => s.endsWith(".tsx"))) {
      for (const m of read(f).matchAll(cls)) {
        const toks = (m[1] ?? m[2] ?? m[3] ?? "").split(/\s+/);
        if (!toks.includes("grid") || toks.includes("grid-flow-col")) continue;
        if (!toks.some((t) => /^[\w[\]\-:.]+:grid-cols-/.test(t))) continue;
        if (toks.some((t) => /^grid-cols-/.test(t))) continue;
        offenders.push(`${f}: ${toks.join(" ").slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  // A bare `fr` track cannot shrink below its content (it is minmax(auto, Nfr)).
  // On /markets at 1024 the AI card's column needed ~213px against ~170px and the
  // whole row ran 22px off the screen. minmax(0, Nfr) is what grid-cols-N uses.
  it("arbitrary grid tracks use minmax(0, Nfr), never a bare fr", () => {
    const offenders: string[] = [];
    for (const f of sources.filter((s) => s.endsWith(".tsx"))) {
      for (const m of read(f).matchAll(/grid-cols-\[([^\]\s"'`]+)\]/g)) {
        if (m[1].split("_").some((t) => /^[\d.]+fr$/.test(t))) offenders.push(`${f}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the markets top row stacks the AI card below on iPad landscape", () => {
    const m = read("src/modules/markets/components/MarketsClient.tsx");
    expect(m).toMatch(/lg:grid-cols-\[minmax\(0,1\.95fr\)_minmax\(0,1\.32fr\)\] xl:grid-cols-\[minmax\(0,1\.95fr\)_minmax\(0,1\.32fr\)_minmax\(0,0\.73fr\)\]/);
    expect(m).toMatch(/lg:col-span-2 xl:col-span-1 xl:min-h-0/);
  });

  it("signed in on a phone under 360px, the Menu button stays on screen", () => {
    expect(read("src/shared/components/Navbar.tsx")).toMatch(/session && "max-\[359px\]:sr-only"/);
  });

  it("the feedback admin stats wrap instead of running off a phone", () => {
    expect(read("src/modules/feedback/components/FeedbackAdmin.tsx")).toMatch(/\{data && \(\s*<div className="flex flex-wrap gap-2">/);
  });
});
