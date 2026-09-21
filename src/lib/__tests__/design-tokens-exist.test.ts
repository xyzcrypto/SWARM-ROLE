import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import config from "../../../tailwind.config";

/**
 * Every brand-ramp shade a component names must actually be defined.
 *
 * ⚠️ This is the single most expensive failure shape in this codebase, and it
 * has now happened four separate times:
 *
 *   `text-content0`      - a token that does not exist
 *   `bg-base/95`         - an opacity modifier on a plain `var()` token
 *   `animate-in`         - a plugin that is not installed (`plugins: []`)
 *   `bg-mint-950`        - a shade past the end of the ramp (mint stops at 800)
 *
 * All four PARSE. Tailwind does not error on a class it cannot resolve, it
 * simply emits no rule - so the element renders with no background, or no
 * animation, or invisible text, and nothing anywhere reports a problem. The
 * `mint-950` one arrived by way of a find-and-replace from `emerald-950`, where
 * 950 is perfectly valid, which is exactly how this keeps happening: the shade
 * is legal in Tailwind's own palettes and illegal in ours.
 *
 * A build cannot catch it and a type check cannot catch it. This can.
 */

type Ramp = Record<string, string>;
const colors = (config.theme?.extend?.colors ?? {}) as Record<string, Ramp | string>;

/** The brand ramps - the ones with numeric shades that can be overrun. */
const RAMPS = ["gold", "mint", "ink"] as const;

/** Every source file, tests excluded - they quote the bad classes on purpose. */
function walk(dir = "src", acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (p.includes("__tests__")) continue;
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith(".tsx") || p.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

const FILES = walk();

/**
 * Comments are not markup.
 *
 * ⚠️ Without this the check reports its own documentation: this codebase
 * explains past silent-CSS failures in comments BY NAME ("this used to be
 * `animate-in fade-in slide-in-from-bottom-1`, which emits nothing"), and a raw
 * scan flags every one of those notes as a live use. A check that fires on the
 * warning about a bug is a check nobody keeps.
 */
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");

const SOURCES = FILES.map((f) => [f, stripComments(readFileSync(f, "utf8"))] as const);

describe("brand colour shades named in components are defined", () => {
  for (const ramp of RAMPS) {
    it(`${ramp}-* never names a shade past the end of the ramp`, () => {
      const defined = new Set(Object.keys((colors[ramp] ?? {}) as Ramp));
      expect(defined.size, `${ramp} ramp should exist in tailwind.config.ts`).toBeGreaterThan(0);

      const pattern = new RegExp(`\\b(?:bg|text|border|ring|from|via|to|shadow|fill|stroke|divide|outline|decoration|accent|caret|placeholder)-${ramp}-(\\d{2,3})\\b`, "g");
      const bad: string[] = [];

      for (const [file, src] of SOURCES) {
        for (const m of src.matchAll(pattern)) {
          if (!defined.has(m[1])) bad.push(`${file}: ${m[0]}`);
        }
      }

      expect(
        bad,
        `these name a ${ramp} shade that is not defined (defined: ${[...defined].join(", ")}), ` +
          `so Tailwind emits NO rule for them:\n  ${bad.join("\n  ")}`
      ).toEqual([]);
    });
  }
});

describe("utilities the handbook names but nothing defines", () => {
  it("does not use shadow-card / shadow-card-hover / shadow-btn", () => {
    // ⚠️ `docs/design-system.md` and the `design-system` skill both list these
    // as the project's shadow tokens. They are defined in NEITHER
    // `tailwind.config.ts` (which has gold, gold-sm, mint, elevate) NOR
    // `globals.css`. Reaching for one because the handbook named it produces a
    // card with no shadow and no complaint - so the rule is enforced here until
    // either the tokens are added or the docs stop naming them.
    const defined = new Set(Object.keys((config.theme?.extend?.boxShadow ?? {}) as Ramp));

    // Named explicitly rather than derived. A general "is this shadow defined"
    // sweep cannot tell `shadow-card` (undefined) from `shadow-gold-500/20`
    // (a perfectly valid Tailwind shadow-COLOUR utility) or `shadow-black`,
    // and flagging those would bury the real finding under a dozen false ones.
    const PHANTOM = ["card", "card-hover", "btn"];
    for (const name of PHANTOM) {
      expect(defined.has(name), `if shadow-${name} has since been defined, drop it from this list`).toBe(false);
    }

    const bad: string[] = [];
    for (const [file, src] of SOURCES) {
      for (const name of PHANTOM) {
        if (new RegExp(`\\bshadow-${name}\\b(?!-)`).test(src)) bad.push(`${file}: shadow-${name}`);
      }
    }

    expect(
      bad,
      `these shadow utilities are named by the handbook but defined nowhere ` +
        `(defined: ${[...defined].join(", ")}), so they emit no rule:\n  ${bad.join("\n  ")}`
    ).toEqual([]);
  });

  it("does not use the tailwindcss-animate classes, which are not installed", () => {
    // `plugins: []`. `animate-in`, `fade-in` and `slide-in-from-*` all come
    // from `tailwindcss-animate` and silently emit nothing without it.
    const bad: string[] = [];
    for (const [file, src] of SOURCES) {
      if (/\banimate-in\b|\bslide-in-from-|\bfade-in-\d/.test(src)) bad.push(file);
    }
    expect(config.plugins).toEqual([]);
    expect(bad, `these need tailwindcss-animate, which is not installed:\n  ${bad.join("\n  ")}`).toEqual([]);
  });
});
