#!/usr/bin/env node
// Per-route client-JS report. Run AFTER `npm run build`:
//
//   node scripts/bundle-report.mjs                  # table for the current build
//   node scripts/bundle-report.mjs > /tmp/before.txt   # ...then diff two branches
//
// WHY THIS EXISTS
// Next 16 removed the `Size` and `First Load JS` columns from build output, so this
// project had no bundle-size regression detection at all - a PR could double the
// client bundle and nothing would report it.
//
// The obvious replacement does not work here. Under **Turbopack**, Next does not
// emit `.next/app-build-manifest.json`; the `cost-check` skill pointed at that file
// for a while and the instruction was simply unfollowable. What Turbopack does emit
// is a per-route RSC manifest at
// `.next/server/app/**/page_client-reference-manifest.js`, listing the client
// modules for each route and the chunks each pulls in. Summing the unique chunks per
// route is the closest honest equivalent to "First Load JS".
//
// HOW TO READ THE NUMBER
// Gzipped bytes of the union of every JS chunk referenced by that route's client
// modules, shared framework chunks included. Routes overlap heavily, so the column
// does NOT sum to a site total - compare a route against ITSELF across two builds,
// which is the regression question. The smallest row is the shared shell every
// route pays.
//
// Chunks behind `next/dynamic` still appear if the route references them, so a big
// number is not automatically a big download - check whether it is lazy before
// acting. three.js is the live example: it is in the graph but `useWebglGate()`
// returns a literal false, so it is never requested.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = ".next";
const APP = join(ROOT, "server", "app");

try {
  statSync(APP);
} catch {
  console.error("No build found. Run `npm run build` first.");
  process.exit(1);
}

/** Every per-route RSC manifest Turbopack emitted. */
function manifests(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) manifests(p, out);
    else if (e.name === "page_client-reference-manifest.js") out.push(p);
  }
  return out;
}

const gzCache = new Map();
function gzipBytes(chunk) {
  if (gzCache.has(chunk)) return gzCache.get(chunk);
  let n = 0;
  try {
    n = gzipSync(readFileSync(join(ROOT, chunk.replace(/^\/_next\//, "")))).length;
  } catch {
    // A chunk listed in the manifest but absent on disk contributes 0 rather than
    // aborting - a slightly-low number beats no report.
  }
  gzCache.set(chunk, n);
  return n;
}

const rows = [];
for (const file of manifests(APP)) {
  const src = readFileSync(file, "utf8");
  const eq = src.indexOf("=", src.indexOf("__RSC_MANIFEST["));
  let parsed;
  try {
    parsed = JSON.parse(src.slice(eq + 1).trim().replace(/;\s*$/, ""));
  } catch {
    continue; // shape changed - skip rather than report a wrong number
  }
  const chunks = new Set();
  for (const mod of Object.values(parsed.clientModules ?? {})) {
    for (const c of mod.chunks ?? []) if (c.endsWith(".js")) chunks.add(c);
  }
  rows.push({
    route: "/" + relative(APP, dirname(file)),
    chunks: chunks.size,
    gzip: [...chunks].reduce((a, c) => a + gzipBytes(c), 0),
  });
}

if (rows.length === 0) {
  console.error(
    "Found no per-route RSC manifests under .next/server/app.\n" +
      "The manifest shape may have changed in a Next upgrade - check before trusting any bundle claim."
  );
  process.exit(1);
}

rows.sort((a, b) => b.gzip - a.gzip);
console.log("route".padEnd(46) + "chunks".padStart(7) + "gzip kB".padStart(10));
for (const r of rows) {
  console.log(r.route.padEnd(46) + String(r.chunks).padStart(7) + (r.gzip / 1024).toFixed(0).padStart(10));
}
console.log(`\n${rows.length} routes. Smallest row is the shared floor; compare a route against itself across builds.`);
