import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A Next.js route module may export only HTTP handlers and segment config.
 *
 * ⚠️ The chat report route briefly exported a `REPORT_REASONS` constant. The
 * Turbopack build (what `npm run build` and Vercel use) accepted it; the
 * webpack build's route-type validation REJECTED it - found only because a
 * browser test harness happened to build with webpack. Invalid under one
 * builder is invalid, so this makes it fail everywhere, every time.
 */
const ALLOWED = new Set([
  "GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS",
  "dynamic", "dynamicParams", "revalidate", "fetchCache", "runtime",
  "preferredRegion", "maxDuration", "generateStaticParams",
]);

function routes(dir = "src/app", acc: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) routes(p, acc);
    else if (/^route\.tsx?$/.test(n)) acc.push(p);
  }
  return acc;
}

describe("route modules export only what Next allows", () => {
  const files = routes();

  it("found the routes (guards against an empty scan)", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("no route exports anything else", () => {
    const bad: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:const|let|function|class|type|interface)\s+([A-Za-z_$][\w$]*)/gm)) {
        if (!ALLOWED.has(m[1]!)) bad.push(`${f}: ${m[1]}`);
      }
      // `export { handler as GET }` is fine - check the EXPORTED name.
      for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) {
        for (const part of m[1]!.split(",")) {
          const name = part.trim().split(/\s+as\s+/).pop()!.trim();
          if (name && !ALLOWED.has(name)) bad.push(`${f}: ${name}`);
        }
      }
    }
    expect(bad, `move these into a lib module:\n  ${bad.join("\n  ")}`).toEqual([]);
  });
});
