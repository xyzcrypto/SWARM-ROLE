import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Every cached API route that a client polls must have an ISR `revalidate` window
// AND a `Cache-Control: s-maxage` at least as long as that poll interval.
//
// If either is SHORTER, it has already expired by the time the next poll arrives,
// so every poll from every open tab triggers a regeneration - paying ISR Writes and
// Fluid Active CPU on a fixed schedule for data that has not changed. Two of the
// three metrics this project rations.
//
// This is pinned by a test because it has already drifted TWICE, silently:
//
//  1. Four of six markets routes were misaligned (120s and 150s windows against a
//     180s poll) while docs/changelog.md claimed "pollers realigned to match each
//     route's new window". Nothing failed, nothing logged - the only symptom was
//     the bill.
//  2. `/api/ticker` had the identical defect (a 60s window and 60s s-maxage against
//     a 150s poll) and survived the fix for (1) by two days, **because this file
//     only ever looked at `src/app/api/markets/*`**. It was found by an audit and
//     fixed by hand in #207; nothing here would have caught it, and nothing here
//     would catch it coming back.
//
// Hence TARGETS below: every polled cached route is listed explicitly, together
// with the file its poll interval actually lives in. **Adding a polled route means
// adding it here** - a test scoped to where the last bug was found does not prevent
// the next one.
//
// If this fails: change the route's `revalidate`, its `s-maxage`, and the client's
// poll interval TOGETHER. Raising the window makes data staler; shortening the poll
// costs more. Neither is automatically right, which is exactly why it needs a human.

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** Source with `//` and block comments removed, so prose cannot satisfy a check. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// Read the REAL implementations, never the `src/lib` / `src/components` re-export
// shims left behind by the modules/core/shared reorganisation (#203). A shim is one
// `export * from` line: pointing this file at one would make every regex below match
// nothing, and the suite would pass while checking absolutely nothing.
const MARKETS_CLIENT = "src/modules/markets/components/MarketsClient.tsx";
const TICKER_POLL = "src/modules/markets/lib/useTickerPoll.ts";
// The news feed's poll lives in the component itself - a third shape again.
const NEWS_CLIENT = "src/modules/news/components/NewsClient.tsx";
// The shared cache for the >2 MB llama.fi upstreams (see the test at the bottom).
const LLAMA = "src/modules/markets/lib/llama.ts";

type Target = {
  /** Human label used in failure messages. */
  label: string;
  /** Route handler, relative to the repo root. */
  routeFile: string;
  /** How often a client fetches it, in ms. */
  pollMs: number;
  /** Where that poll interval is defined - named so a failure says where to look. */
  pollSource: string;
};

/**
 * `/api/markets/*` - poll intervals are declared inline at the call site, e.g.
 * `usePolledJson<DefiResp>("/api/markets/defi", 180_000)`.
 */
function marketsTargets(): Target[] {
  const src = read(MARKETS_CLIENT);
  const out: Target[] = [];
  for (const m of src.matchAll(/usePolledJson<[^>]*>\(\s*"\/api\/markets\/(\w+)"\s*,\s*([\d_]+)\s*\)/g)) {
    out.push({
      label: `markets/${m[1]!}`,
      routeFile: `src/app/api/markets/${m[1]!}/route.ts`,
      pollMs: Number(m[2]!.replace(/_/g, "")),
      pollSource: MARKETS_CLIENT,
    });
  }
  return out;
}

/**
 * `/api/ticker` - polled from a shared hook rather than from a page component, so
 * its interval lives in its own module as `const POLL_MS = 150_000`. That shape is
 * exactly what a `src/app/api/markets/*` glob could not see, which is why the
 * misalignment survived here.
 */
function tickerTarget(): Target {
  const m = read(TICKER_POLL).match(/^const POLL_MS = ([\d_]+);/m);
  if (!m) throw new Error(`could not parse POLL_MS out of ${TICKER_POLL}`);
  return {
    label: "ticker",
    routeFile: "src/app/api/ticker/route.ts",
    pollMs: Number(m[1]!.replace(/_/g, "")),
    pollSource: TICKER_POLL,
  };
}

/** e.g. `export const revalidate = 180;` → 180 (seconds) */
function revalidateSeconds(routeFile: string): number | null {
  const m = read(routeFile).match(/^export const revalidate = (\d+);/m);
  return m ? Number(m[1]) : null;
}

/**
 * The success response's `s-maxage`, i.e. every `s-maxage` that ships alongside a
 * `stale-while-revalidate`. The bare short ones (`s-maxage=45`, `s-maxage=30`) are
 * the degraded/fallback responses and are deliberately brief so a bad response does
 * not stick — they are excluded here on purpose.
 */
function successSMaxAge(routeFile: string): number[] {
  return [...read(routeFile).matchAll(/s-maxage=(\d+),\s*stale-while-revalidate=\d+/g)].map((x) => Number(x[1]));
}

/**
 * `/api/news` - polled from `NewsClient`, so its interval lives in a component
 * rather than in the markets client or a hook. That is the third distinct shape
 * for "where a poll interval lives", and it is why this route went uncovered.
 *
 * It had the identical defect the two above were added for: `revalidate = 90`
 * and `s-maxage=90` against a **90s** poll. Equal is not safe - the window
 * expires exactly as the next poll arrives and jitter decides whether it
 * regenerates - and Vercel analytics showed the result plainly: `/news` at
 * **560 ISR Writes against 166 Reads**, the worst ratio on the site.
 *
 * The lesson from the ticker repeats: a check scoped to where the last bug was
 * found does not prevent the next one. Any new polled route belongs here.
 */
function newsTarget(): Target {
  const m = read(NEWS_CLIENT).match(/^export const NEWS_POLL_MS = ([\d_]+);/m);
  if (!m) throw new Error(`could not parse NEWS_POLL_MS out of ${NEWS_CLIENT}`);
  return {
    label: "news",
    routeFile: "src/app/api/news/route.ts",
    pollMs: Number(m[1]!.replace(/_/g, "")),
    pollSource: NEWS_CLIENT,
  };
}

const TARGETS: Target[] = [...marketsTargets(), tickerTarget(), newsTarget()];

describe("polled API routes keep their ISR + edge windows aligned with client polling", () => {
  it("finds every polled route (guards against a silently empty parse)", () => {
    // Without this, a refactor that changes either call shape - or a path that
    // silently starts resolving to a re-export shim - would make every assertion
    // below vacuously pass. Six markets routes + the ticker.
    expect(TARGETS.length).toBeGreaterThanOrEqual(7);
    expect(TARGETS.map((t) => t.label)).toContain("ticker");
    // Every target must have parsed a real poll interval, not a default of 0.
    expect(TARGETS.filter((t) => !Number.isFinite(t.pollMs) || t.pollMs <= 0)).toEqual([]);
  });

  it("gives every polled route a revalidate window >= its poll interval", () => {
    const bad: string[] = [];
    for (const t of TARGETS) {
      const revalidate = revalidateSeconds(t.routeFile);
      if (revalidate === null) {
        bad.push(`${t.label}: no 'export const revalidate' found in ${t.routeFile}`);
        continue;
      }
      const pollSec = t.pollMs / 1000;
      if (revalidate < pollSec) {
        bad.push(`${t.label}: revalidate ${revalidate}s < poll ${pollSec}s (${t.pollSource}) — regenerates on every poll`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("gives every polled route an s-maxage >= its poll interval", () => {
    // THIS is the assertion that actually protects the CDN. Measured on production
    // 2026-07-31: with `export const revalidate = 200` but `s-maxage=150`, the edge
    // entry went STALE at age 162s — i.e. **`s-maxage` governs the edge,
    // `revalidate` does not**. A fix that moves only the export is cosmetic.
    //
    // Method, if this ever needs re-checking: fetch the route repeatedly from a
    // browser on the live site and watch the `age` and `x-vercel-cache` response
    // headers. `age` resets when the entry is regenerated.
    const bad: string[] = [];
    for (const t of TARGETS) {
      const pollSec = t.pollMs / 1000;
      const values = successSMaxAge(t.routeFile);
      if (values.length === 0) {
        bad.push(`${t.label}: no success-path s-maxage found in ${t.routeFile}`);
        continue;
      }
      for (const v of values) {
        if (v < pollSec) bad.push(`${t.label}: s-maxage ${v}s < poll ${pollSec}s — edge goes stale before each poll`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("keeps s-maxage and revalidate in agreement", () => {
    // Two windows on one route that disagree is how the previous bug hid: the
    // export read 200 while the header said 150, and only one was in charge.
    const bad: string[] = [];
    for (const t of TARGETS) {
      const rv = revalidateSeconds(t.routeFile);
      if (rv === null) continue;
      for (const v of successSMaxAge(t.routeFile)) {
        if (v !== rv) bad.push(`${t.label}: s-maxage ${v}s != revalidate ${rv}s — only one of these governs`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("has no inner fetch hint shorter than the route's own window", () => {
    // Next takes the MINIMUM `revalidate` across a route segment, so a single
    // `next: { revalidate: N }` on any fetch inside the handler silently governs
    // the whole route regardless of `export const revalidate`.
    //
    // Not hypothetical: when this file was first written, `coins` exported 200
    // while a trending sub-fetch was pinned at 120, and `global` exported 200 while
    // a gas-price RPC was pinned at 20. Both exports looked correct.
    //
    // The preferred shape `next: { revalidate }` - shorthand for the route's own
    // exported const - is invisible to this regex by design: there is only one
    // number, so it cannot drift. /api/ticker uses that shape for all three of its
    // upstreams.
    const bad: string[] = [];
    for (const t of TARGETS) {
      const routeWindow = revalidateSeconds(t.routeFile);
      if (routeWindow === null) continue;
      for (const m of read(t.routeFile).matchAll(/next:\s*\{\s*revalidate:\s*(\d+)\s*\}/g)) {
        const hint = Number(m[1]);
        if (hint < routeWindow) {
          bad.push(`${t.label}: inner fetch hint ${hint}s < route window ${routeWindow}s — governs the whole route`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("keeps the shared llama.ts TTLs >= the windows they serve", () => {
    // ⚠️ Widening the guard along with the code it guards.
    //
    // The >2 MB llama.fi upstreams used to carry `next: { revalidate }` inside
    // the route files, where the "no inner hint shorter than the route window"
    // test above could see them. Those hints were inert - the data cache rejects
    // anything over ~2 MB - so they moved into `llama.ts` as `unstable_cache`
    // TTLs around the REDUCED value, which does fit.
    //
    // That move would otherwise have quietly taken those numbers out of this
    // file's sight, and this project has been bitten by exactly that before: the
    // first version of this test globbed `api/markets/*` only, so /api/ticker's
    // identical defect went uncaught because its poll lived elsewhere. A check
    // scoped to where the last bug was found does not prevent the next one.
    const src = read(LLAMA);
    const ttl = (name: string) => {
      const m = src.match(new RegExp(`export const ${name} = (\\d+);`));
      return m ? Number(m[1]) : null;
    };
    const shortestPollSec = Math.min(...TARGETS.map((t) => t.pollMs / 1000));

    // 🔴 The binding rule, and it is the opposite of the intuitive one.
    //
    // Next takes the MINIMUM revalidate across a route segment and an
    // `unstable_cache` TTL counts, so a TTL BELOW a consumer's own
    // `export const revalidate` silently becomes that route's real window.
    // Measured when this landed: OVERVIEW_TTL at 200 pulled /api/markets/dex
    // from ≈5m to ≈3m in the build output - under its 300s poll - while the
    // route file still read 320. Hence: TTL >= the LARGEST consumer window.
    const CONSUMERS: Record<string, string[]> = {
      OVERVIEW_TTL: ["src/app/api/markets/dex/route.ts", "src/app/api/markets/perp/route.ts"],
      PROTOCOLS_TTL: ["src/app/api/markets/defi/route.ts"],
      YIELDS_TTL: ["src/app/api/markets/yields/route.ts"],
    };

    const bad: string[] = [];
    for (const [name, consumers] of Object.entries(CONSUMERS)) {
      const v = ttl(name);
      if (v === null) {
        bad.push(`${name}: not found in ${LLAMA} — did it get renamed or inlined?`);
        continue;
      }
      // A shared TTL shorter than the fastest poll it feeds means the expensive
      // upstream is re-fetched on essentially every poll.
      if (v < shortestPollSec) {
        bad.push(`${name} ${v}s < shortest poll ${shortestPollSec}s — the >2 MB upstream refetches per poll`);
      }
      for (const c of consumers) {
        const w = revalidateSeconds(c);
        if (w !== null && v < w) {
          bad.push(`${name} ${v}s < ${c}'s window ${w}s — segment minimum makes ${v}s that route's REAL window`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("has no >2 MB llama upstream fetched outside llama.ts", () => {
    // The four bodies the build log named as uncacheable. Fetching one directly
    // from a route re-introduces both halves of the problem: it is re-downloaded
    // and re-parsed per regeneration, and it is no longer shared with the other
    // route that wants the same URL.
    const OVERSIZED = [
      "yields.llama.fi/pools",
      "api.llama.fi/protocols",
      "api.llama.fi/overview/dexs",
      "api.llama.fi/overview/fees",
      "api.llama.fi/overview/derivatives",
    ];
    const files = [...TARGETS.map((t) => t.routeFile), "src/app/sitemap.ts"];
    const bad: string[] = [];
    for (const f of files) {
      // Comments are stripped first, the same way the `token.iat` assertion in
      // password-change-revokes-sessions.test.ts does it: these files name the
      // oversized URLs in prose to explain why they no longer fetch them, and an
      // assertion that trips on its own explanation just gets deleted.
      const src = stripComments(read(f));
      for (const url of OVERSIZED) {
        // `overview/${kind}` template literals count too, hence the loose match.
        if (src.includes(url)) bad.push(`${f} fetches ${url} directly — route it through llama.ts`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("keeps a margin so jitter cannot land a poll on an just-expired window", () => {
    // Exactly equal is a coin flip: the window expires at the same moment the
    // poll fires, so scheduling jitter decides whether it regenerates. A small
    // margin makes it deterministic.
    const tight = TARGETS.map((t) => ({ ...t, revalidate: revalidateSeconds(t.routeFile), pollSec: t.pollMs / 1000 }))
      .filter((r) => r.revalidate !== null && r.revalidate! >= r.pollSec && r.revalidate! < r.pollSec * 1.05)
      .map((r) => `${r.label}: revalidate ${r.revalidate}s vs poll ${r.pollSec}s`);
    expect(tight).toEqual([]);
  });
});
