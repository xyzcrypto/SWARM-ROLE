import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Searching a coin and clicking it sent you to `/markets` - the top-250 index,
// no filter, no anchor - instead of that coin's page. The data was never
// missing: `/api/markets/search` returns `id: String(d.id ?? "")` on every row
// and `/markets/[id]` has always existed. The palette mapped the response and
// dropped the id, so `choose` had nothing to route with.
//
// That shape of bug - the payload is right, the destination exists, one field
// is dropped in between - is invisible in a diff and invisible in CI. Hence a
// test that reads the wiring itself.
//
// Real source paths on purpose: `src/components/*` and `src/lib/*` are
// re-export shims after #203, so reading one matches nothing and passes while
// verifying nothing.
const palette = readFileSync("src/shared/components/CommandPalette.tsx", "utf8");
const api = readFileSync("src/app/api/markets/search/route.ts", "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const src = strip(palette);

describe("a search result lands on the thing you clicked", () => {
  it("the API still supplies the id the router needs", () => {
    // If this ever stops being returned, the palette silently falls back to the
    // index again - so fail here rather than shipping the old behaviour back.
    expect(strip(api)).toMatch(/id:\s*String\(d\.id/);
  });

  it("carries the coin id through the response mapping", () => {
    expect(src).toMatch(/kind:\s*"coin"[\s\S]{0,200}id:\s*String\(c\.id/);
  });

  it("routes a coin to its own page, not the markets index", () => {
    expect(src).toMatch(/router\.push\(\s*row\.id\s*\?\s*`\/markets\/\$\{encodeURIComponent\(row\.id\)\}`/);
    // The bare push is only allowed as the fallback for a row with no id.
    expect(src).not.toMatch(/kind === "coin"\)\s*\{\s*router\.push\("\/markets"\)/);
  });

  it("routes research and news as before", () => {
    expect(src).toMatch(/router\.push\(`\/research\/\$\{row\.slug\}`\)/);
    expect(src).toMatch(/safeHref\(row\.url\)/);
  });

  it("keys news rows by url, not by array index", () => {
    // With an index key, row 0 of the old result set and row 0 of the new one
    // reconcile as the same element, so a headline can morph into a different
    // story mid-type while the reader is aiming at it.
    expect(src).toMatch(/key:\s*`news-\$\{n\.url\}`/);
    expect(src).not.toMatch(/key:\s*`news-\$\{i\}`/);
  });
});

describe("recent searches", () => {
  it("records the query only once a result is chosen", () => {
    // Saving every keystroke produces a list of half-typed fragments, which is
    // worse than no list at all.
    expect(src).toMatch(/setRecent\(pushRecent\(q\)\)/);
    expect(src).not.toMatch(/useEffect[\s\S]{0,200}pushRecent/);
  });

  it("only stands in for an empty query", () => {
    // Recents must never sit between the reader and a real hit.
    expect(src).toMatch(/q\.trim\(\)\.length >= 2 \? \[\]/);
  });

  it("re-runs the query instead of navigating, and keeps the panel open", () => {
    expect(src).toMatch(/kind === "recent"[\s\S]{0,160}setQ\(row\.query\)[\s\S]{0,120}return;/);
  });

  it("survives storage being unavailable", () => {
    // Private mode and blocked site-data both throw on read AND on write.
    // Recents are a convenience; they must never take the search box down.
    expect(src).toMatch(/function readRecent[\s\S]{0,400}catch\s*\{[\s\S]{0,120}return \[\]/);
    expect(src).toMatch(/function pushRecent[\s\S]{0,600}catch\s*\{/);
  });

  it("does not read storage from an effect body", () => {
    // `setState` in an effect schedules a second render for something React can
    // settle in the first. This file already uses the adjust-during-render
    // pattern for the highlight; recents use the same one.
    expect(src).not.toMatch(/useEffect\([\s\S]{0,200}setRecent\(readRecent\(\)\)/);
    expect(src).toMatch(/prevOpen !== open[\s\S]{0,140}setRecent\(readRecent\(\)\)/);
  });
});
