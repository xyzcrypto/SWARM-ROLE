import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Every /api/markets/* route's ISR `revalidate` window must be at least as long
// as the interval MarketsClient polls it at.
//
// If the window is SHORTER, it has already expired by the time the next poll
// arrives, so every poll from every open /markets tab triggers a regeneration -
// paying ISR Writes and Fluid Active CPU on a fixed schedule for data that has
// not changed. Two of the three metrics this project rations.
//
// This is pinned by a test because it has already drifted once, silently: four
// of six routes were misaligned (120s and 150s windows against a 180s poll)
// while docs/changelog.md claimed "pollers realigned to match each route's new
// window". Nothing failed, nothing logged - the only symptom was the bill.
//
// If this fails: change the route's `revalidate` and the client's poll interval
// TOGETHER. Raising the window makes data staler; shortening the poll costs
// more. Neither is automatically right, which is exactly why it needs a human.

const CLIENT = readFileSync(join(process.cwd(), "src/components/MarketsClient.tsx"), "utf8");

/** e.g. usePolledJson<DefiResp>("/api/markets/defi", 180_000) → { defi: 180000 } */
function pollIntervals(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of CLIENT.matchAll(/usePolledJson<[^>]*>\(\s*"\/api\/markets\/(\w+)"\s*,\s*([\d_]+)\s*\)/g)) {
    out[m[1]!] = Number(m[2]!.replace(/_/g, ""));
  }
  return out;
}

/** e.g. `export const revalidate = 200;` → 200 (seconds) */
function revalidateSeconds(route: string): number | null {
  const src = readFileSync(join(process.cwd(), `src/app/api/markets/${route}/route.ts`), "utf8");
  const m = src.match(/^export const revalidate = (\d+);/m);
  return m ? Number(m[1]) : null;
}

/**
 * The success response's `s-maxage`, i.e. every `s-maxage` that ships alongside a
 * `stale-while-revalidate`. The bare short ones (`s-maxage=45` etc.) are the
 * degraded/fallback responses and are deliberately brief so a bad response does
 * not stick — they are excluded here on purpose.
 */
function successSMaxAge(route: string): number[] {
  const src = readFileSync(join(process.cwd(), `src/app/api/markets/${route}/route.ts`), "utf8");
  return [...src.matchAll(/s-maxage=(\d+),\s*stale-while-revalidate=\d+/g)].map((m) => Number(m[1]));
}

describe("markets ISR windows are aligned with client polling", () => {
  const polls = pollIntervals();

  it("finds the polled routes (guards against a silently empty parse)", () => {
    // Without this, a refactor of MarketsClient that changes the call shape
    // would make the assertion below vacuously pass.
    expect(Object.keys(polls).length).toBeGreaterThanOrEqual(6);
  });

  it("gives every polled route a revalidate window >= its poll interval", () => {
    const bad: string[] = [];
    for (const [route, everyMs] of Object.entries(polls)) {
      const revalidate = revalidateSeconds(route);
      if (revalidate === null) {
        bad.push(`${route}: no 'export const revalidate' found`);
        continue;
      }
      const pollSec = everyMs / 1000;
      if (revalidate < pollSec) {
        bad.push(`${route}: revalidate ${revalidate}s < poll ${pollSec}s — regenerates on every poll`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("gives every polled route an s-maxage >= its poll interval", () => {
    // THIS is the assertion that actually protects the CDN, and it was missing
    // when this file was written. Measured on production 2026-07-31: with
    // `export const revalidate = 200` but `s-maxage=150`, the edge entry went
    // STALE at age 162s — i.e. **`s-maxage` governs the edge, `revalidate` does
    // not**. Against a 180s poll that means every poll still regenerated, which
    // is the exact misalignment this file was created to prevent, and the
    // assertions above passed the whole time.
    //
    // Method, if this ever needs re-checking: fetch the route repeatedly from a
    // browser on the live site and watch the `age` and `x-vercel-cache` response
    // headers. `age` resets when the entry is regenerated.
    const bad: string[] = [];
    for (const [route, everyMs] of Object.entries(polls)) {
      const pollSec = everyMs / 1000;
      const values = successSMaxAge(route);
      if (values.length === 0) {
        bad.push(`${route}: no success-path s-maxage found`);
        continue;
      }
      for (const v of values) {
        if (v < pollSec) bad.push(`${route}: s-maxage ${v}s < poll ${pollSec}s — edge goes stale before each poll`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("keeps s-maxage and revalidate in agreement", () => {
    // Two windows on one route that disagree is how the previous bug hid: the
    // export read 200 while the header said 150, and only one was in charge.
    const bad: string[] = [];
    for (const route of Object.keys(polls)) {
      const rv = revalidateSeconds(route);
      if (rv === null) continue;
      for (const v of successSMaxAge(route)) {
        if (v !== rv) bad.push(`${route}: s-maxage ${v}s != revalidate ${rv}s — only one of these governs`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("has no inner fetch hint shorter than the route's own window", () => {
    // Next takes the MINIMUM `revalidate` across a route segment, so a single
    // `next: { revalidate: N }` on any fetch inside the handler silently governs
    // the whole route regardless of `export const revalidate`.
    //
    // This is not hypothetical, and it is why the assertions above are not
    // enough on their own: when this file was first written, `coins` exported
    // 200 while a trending sub-fetch was pinned at 120, and `global` exported
    // 200 while a gas-price RPC was pinned at 20 - so the route actually
    // regenerated every 20 SECONDS. Both exports looked correct. Only the build
    // output disagreed.
    const bad: string[] = [];
    for (const route of Object.keys(polls)) {
      const routeWindow = revalidateSeconds(route);
      if (routeWindow === null) continue;
      const src = readFileSync(join(process.cwd(), `src/app/api/markets/${route}/route.ts`), "utf8");
      for (const m of src.matchAll(/next:\s*\{\s*revalidate:\s*(\d+)\s*\}/g)) {
        const hint = Number(m[1]);
        if (hint < routeWindow) {
          bad.push(`${route}: inner fetch hint ${hint}s < route window ${routeWindow}s — governs the whole route`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("keeps a margin so jitter cannot land a poll on an just-expired window", () => {
    // Exactly equal is a coin flip: the window expires at the same moment the
    // poll fires, so scheduling jitter decides whether it regenerates. A small
    // margin makes it deterministic.
    const tight = Object.entries(polls)
      .map(([route, everyMs]) => ({ route, revalidate: revalidateSeconds(route), pollSec: everyMs / 1000 }))
      .filter((r) => r.revalidate !== null && r.revalidate! >= r.pollSec && r.revalidate! < r.pollSec * 1.05)
      .map((r) => `${r.route}: revalidate ${r.revalidate}s vs poll ${r.pollSec}s`);
    expect(tight).toEqual([]);
  });
});
