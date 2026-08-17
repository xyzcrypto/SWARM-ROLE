import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import robots from "@/app/robots";

/**
 * Source with comments removed. These files name the old, blocked path in prose
 * to explain why they no longer use it — the same reason the `token.iat`
 * assertion strips comments. An assertion that trips on its own explanation just
 * gets deleted by whoever hits it next.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// A social preview image has to be FETCHABLE by the crawler, and robots.txt is
// what decides that.
//
// ⚠️ The bug this exists for, reported from a screenshot of an X compose box:
// sharing a Points Value result posted with no banner at all. The metadata was
// correct — `twitter:card = summary_large_image`, a real 1200x630 PNG route,
// absolute URL, the lot. But the image lived at
// `/api/tools/share/points-value/<id>` and `robots.ts` disallows `/api/`.
//
// **X's card crawler obeys robots.txt for the image, not just the page.** So it
// fetched the page, read a perfectly valid `twitter:image`, and then refused to
// fetch it. Every points share went out bare, for every listed perp DEX, while
// the homepage and research cards — whose images sit outside `/api/` — worked.
// That asymmetry is what made it look like a tools-only problem.
//
// Nothing failed, nothing logged, and no amount of re-reading the metadata would
// have shown it. Hence a test that compares the two against each other.

/** The disallow list as `robots.ts` actually emits it. */
function disallowedPrefixes(): string[] {
  const rules = robots().rules;
  const list = Array.isArray(rules) ? rules : [rules];
  return list.flatMap((r) => {
    const d = r.disallow;
    return d === undefined ? [] : Array.isArray(d) ? d : [d];
  });
}

/** Every .ts/.tsx file under src/app, which is where metadata is declared. */
function appFiles(dir = "src/app"): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...appFiles(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Paths this file's source assigns to an `image`-ish binding. Deliberately
 * source-level: the real URLs are built per-request from a database row, so
 * there is nothing to call — the template literal is the thing to check.
 */
function imagePathsIn(src: string): string[] {
  const out: string[] = [];
  // `const image = \`${SITE_URL}/foo/${x}\`` and `images: ["/foo"]`
  for (const m of src.matchAll(/(?:image[sA-Za-z]*\s*[:=]\s*\[?\s*)`([^`]*)`/g)) out.push(m[1]!);
  for (const m of src.matchAll(/(?:image[sA-Za-z]*\s*[:=]\s*\[?\s*)"([^"]*)"/g)) out.push(m[1]!);
  return out
    .map((v) => v.replace("${SITE_URL}", "").replace(/\$\{[^}]*\}/g, "x"))
    .filter((v) => v.startsWith("/"));
}

describe("social preview images must not sit behind a robots.txt disallow", () => {
  it("robots.ts still disallows /api/ (the premise of this test)", () => {
    expect(disallowedPrefixes()).toContain("/api/");
  });

  it("no metadata image in src/app points into a disallowed path", () => {
    const blocked = disallowedPrefixes();
    const bad: string[] = [];
    for (const file of appFiles()) {
      for (const p of imagePathsIn(stripComments(readFileSync(file, "utf8")))) {
        const hit = blocked.find((prefix) => p.startsWith(prefix));
        if (hit) bad.push(`${file}: image "${p}" is under a robots.txt Disallow ("${hit}") — crawlers will skip it`);
      }
    }
    expect(bad).toEqual([]);
  });

  // The specific one that was broken, named so a regression is obvious rather
  // than a generic failure somewhere in src/app.
  it("the points-value share card is served from a crawlable path", () => {
    const src = stripComments(readFileSync("src/app/tools/share/points-value/[id]/page.tsx", "utf8"));
    expect(src).toContain("/tools/share/points-value/");
    expect(src).not.toContain("/api/tools/share/points-value/");
  });
});
