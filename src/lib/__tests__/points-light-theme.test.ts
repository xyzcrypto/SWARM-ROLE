import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SHARE_NAME_MAX, shareName } from "@modules/points/lib/points";

// Measured on /points in the LIGHT theme before this was fixed: 21 distinct
// text runs below WCAG AA, and not marginally - the assumption banner at
// **1.1:1**, the locked-venue box at **1.01:1**, and every cell of the
// sensitivity grid at **1.01:1**. The whole grid was invisible, not merely
// low-contrast.
//
// One cause for all of it: dark-theme foregrounds (`text-mint-100`,
// `text-amber-200`, `text-sky-200`, `text-rose-200`) on translucent tints of
// their own hue. Over near-black they read fine; over near-white the tint stays
// pale and the text stays pale with it.
//
// After: 0 failures in light AND 0 in dark, at 1440px and 393px.
const css = readFileSync("src/app/globals.css", "utf8");
const COMPONENTS = "src/modules/points/components";

/**
 * Comments out before matching. These files document the exact classes they
 * must not use - the grid's comment names `text-mint-100` and the 1.01:1 it
 * scored - so a raw-text check would fail on its own explanation. This repo
 * has the same helper in five other test files for the same reason.
 */
const strip = (s: string) =>
  s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ");

const sources = Object.fromEntries(
  readdirSync(COMPONENTS)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => [f, strip(readFileSync(join(COMPONENTS, f), "utf8"))])
);

describe("the points UI themes instead of assuming a dark ground", () => {
  it("uses the theme-aware data tokens for up/down numbers", () => {
    // The design system says this in as many words: use these "for up/down
    // numbers rather than text-mint-*/text-red-* so new UI is readable in both
    // themes". The grid did the opposite and scored 1.01:1.
    const grid = sources["SensitivityGrid.tsx"];
    // ⚠️ Scoped classes, not the raw tokens - and that distinction was measured.
    // `--data-down` is documented at 4.54:1, but that is against PURE WHITE.
    // These cells sit on `.surface` under a tint of their own hue, where every
    // losing cell scored **4.27:1**. Lowering the tint did not help (re-measured
    // at 0.28 alpha: still 4.27) because the foreground was what was short.
    expect(grid).toMatch(/grid-net-up/);
    expect(grid).toMatch(/grid-net-down/);
    expect(grid).not.toMatch(/text-mint-100/);
    expect(grid).not.toMatch(/text-rose-200/);
    expect(css).toMatch(/html:not\(\.dark\) \.grid-net-down \{ color: #b91c1c; \}/);
  });

  it("does not paint grid cells with a hard-coded brand rgba", () => {
    // `rgba(34, 214, 146, a)` is mint-400 pinned to the dark palette. The cells
    // mix the semantic token instead, so the tint follows the theme too.
    expect(sources["SensitivityGrid.tsx"]).toMatch(/color-mix\(in srgb, var\(--data-(up|down)\)/);
    expect(sources["SensitivityGrid.tsx"]).not.toMatch(/rgba\(34, ?214, ?146/);
  });

  it("has a light override for every tinted callout foreground it uses", () => {
    // These four only ever worked on a dark ground. Each needs a light-theme
    // colour or it disappears; the pattern already existed for text-mint-200.
    for (const cls of ["text-amber-200", "text-sky-200", "text-mint-100", "text-rose-200"]) {
      expect(css, `${cls} has no html:not(.dark) override`).toMatch(
        new RegExp(`html:not\\(\\.dark\\) \\.${cls.replace(/-/g, "-")}\\s*\\{`)
      );
    }
  });

  it("prefers semantic text tokens over the zinc ramp in the points UI", () => {
    // `text-zinc-600` on a light card is the same failure in a quieter form.
    // Not a ban site-wide - just here, where the whole surface was rebuilt.
    const offenders: string[] = [];
    for (const [file, src] of Object.entries(sources)) {
      for (const m of src.matchAll(/text-zinc-(\d00)/g)) offenders.push(`${file}: ${m[0]}`);
    }
    expect(offenders, `dark-only text colours left in the points UI:\n  ${offenders.join("\n  ")}`).toEqual([]);
  });
});

describe("every semantic colour class actually exists", () => {
  // ⚠️ This test exists because of a real bug it would have caught instantly.
  //
  // The zinc-to-semantic migration was done with an ordered find-and-replace,
  // and `text-zinc-50` was listed BEFORE `text-zinc-500`. So every
  // `text-zinc-500` matched the shorter rule first and became `text-content`
  // plus a leftover `0`: **`text-content0`**, thirteen times.
  //
  // Tailwind does not generate that class, so those elements silently
  // inherited their parent's colour. Nothing threw, the build passed, and the
  // CONTRAST AUDIT PASSED TOO - the inherited colour happened to be legible,
  // so measuring contrast could not see it. Only the class name itself can.
  const config = readFileSync("tailwind.config.ts", "utf8");

  /** The semantic token names Tailwind is actually configured to emit. */
  const tokens = new Set<string>();
  for (const m of config.matchAll(/^\s*"?([a-z][a-z0-9-]*)"?:\s*"var\(--/gm)) tokens.add(m[1]);
  // `content` and friends are declared as bare keys too; catch those.
  for (const k of ["base", "surface", "surface-2", "content", "content-muted", "content-subtle", "hairline", "data-up", "data-down"]) {
    if (config.includes(`"${k}"`) || config.includes(`${k}:`)) tokens.add(k);
  }

  it("parsed a plausible token set from tailwind.config.ts", () => {
    // Guard against a silently empty parse making the check below vacuous.
    expect(tokens.size).toBeGreaterThanOrEqual(6);
    expect(tokens.has("content")).toBe(true);
    expect(tokens.has("hairline")).toBe(true);
  });

  it("never puts an opacity modifier on a var-based semantic token", () => {
    // ⚠️ Measured: `bg-base/95` on the section nav rendered the bar at **alpha
    // 0** - no background rule emitted at all - so dense card text read straight
    // through the labels while scrolling.
    //
    // These tokens are declared as plain `var(--bg)` rather than in the
    // `rgb(... / <alpha-value>)` form, and Tailwind cannot apply an opacity
    // modifier to an arbitrary value. It does not warn; it emits nothing. Same
    // family as `text-content0`: a class that parses, means nothing, and fails
    // silently. Brand ramps (`gold-500/15`, `mint-500/10`) are real colours and
    // are unaffected.
    const bad: string[] = [];
    const semantic = "base|surface|surface-2|content|content-muted|content-subtle|hairline|data-up|data-down";
    for (const [file, src] of Object.entries(sources)) {
      for (const m of src.matchAll(new RegExp(`\\b(?:bg|text|border|ring|from|to|via)-(?:${semantic})\\/[0-9]+`, "g"))) {
        bad.push(`${file}: ${m[0]}`);
      }
    }
    expect(
      bad,
      `an opacity modifier on a var() token emits NO rule:\n  ${bad.join("\n  ")}`
    ).toEqual([]);
  });

  it("uses no animation utility from a plugin this repo does not install", () => {
    // ⚠️ `animate-in`, `fade-in`, `slide-in-from-*`, `zoom-in` belong to
    // `tailwindcss-animate`. `tailwind.config.ts` has `plugins: []`, so those
    // classes parse, generate NOTHING, and fail silently - the same family as
    // `bg-base/95` (no rule emitted) and `text-content0` (class does not exist).
    //
    // This project has its own keyframes in the config: `animate-fade-up`,
    // `animate-float`, `animate-shine`, `animate-pulse-dot`, `animate-spin-slow`.
    const bad: string[] = [];
    for (const [file, src] of Object.entries(sources)) {
      for (const m of src.matchAll(/\banimate-(in|out)\b|\bslide-in-from-[a-z]+-\d+\b|\bzoom-in\b|\bfill-mode-\w+\b/g)) {
        bad.push(`${file}: ${m[0]}`);
      }
    }
    expect(
      bad,
      `these need tailwindcss-animate, which is not installed - they emit no CSS:\n  ${bad.join("\n  ")}`
    ).toEqual([]);
  });

  it("uses no semantic class Tailwind will not generate", () => {
    const bad: string[] = [];
    for (const [file, src] of Object.entries(sources)) {
      for (const m of src.matchAll(/\b(?:text|bg|border|ring|fill|stroke)-((?:content|surface|hairline|data|base)[a-z0-9-]*)/g)) {
        if (!tokens.has(m[1])) bad.push(`${file}: ${m[0]}`);
      }
    }
    expect(bad, `classes referencing a token that does not exist:\n  ${bad.join("\n  ")}`).toEqual([]);
  });
});

describe("the share name cannot silently fail the share", () => {
  it("falls back through label -> programme -> venue", () => {
    expect(shareName("My Variational bag", "Variational", "Variational")).toBe("My Variational bag");
    expect(shareName("   ", "Variational", "Aster")).toBe("Variational");
    expect(shareName("", null, "Aster")).toBe("Aster");
    expect(shareName("", null, null)).toBe("Perp DEX");
  });

  it("truncates to what the API will accept", () => {
    // The share route's zod schema is `z.string().max(40)` and REJECTS beyond
    // it. Without this, a long name produced "Couldn't create the share link"
    // with nothing pointing at the name as the cause.
    const long = "A".repeat(120);
    expect(shareName(long).length).toBe(SHARE_NAME_MAX);
    expect(SHARE_NAME_MAX).toBe(40);
  });

  it("is what the share payload actually sends", () => {
    expect(sources["ValuePanel.tsx"]).toMatch(/platform: shareName\(/);
  });

  it("caps the input itself, so the counter never lies", () => {
    expect(sources["ValuePanel.tsx"]).toMatch(/maxLength=\{SHARE_NAME_MAX\}/);
  });
});

describe("the grid earns its space", () => {
  it("shows a return multiple, with break-even as the pivot", () => {
    // Net dollars on a geometric ladder is dominated by one corner, and when
    // every cell is profitable the table is uniformly green and says nothing.
    const grid = sources["SensitivityGrid.tsx"];
    expect(grid).toMatch(/formatMultiple/);
    expect(grid).toMatch(/1\.0x is\s*\n?\s*break-even|1\.0x is <\/strong>|break-even/);
  });

  it("falls back to dollars rather than dividing by zero", () => {
    expect(sources["SensitivityGrid.tsx"]).toMatch(/hasCost = totalCostUsd > 0/);
  });

  it("ships a legend, because a colour scale without one is decoration", () => {
    expect(sources["SensitivityGrid.tsx"]).toMatch(/function Legend/);
  });
});
