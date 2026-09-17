import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { OVERVIEW_TTL } from "@modules/markets/lib/llama";
import { buildComparables, pickMetricFor, type CompVenue } from "@modules/points/lib/points";

// `/api/points/comps` reads `llamaOverview("derivatives")`, an `unstable_cache`
// shared with /api/markets/{perp,dex} and sitemap.ts. Next takes the MINIMUM
// revalidate across a route segment, so a window longer than that shared TTL is
// silently truncated to it - the route file says one number and the route table
// shows another. That is trap 1b in the cost-check skill, and it has shipped
// here twice before.
//
// The obvious fix - `export const revalidate = OVERVIEW_TTL` - does NOT build:
// Next only statically analyses segment config exports, and an imported const
// fails the build with "Invalid segment configuration export". So the route has
// to carry a literal, and a literal can drift. This test is the thing that
// stops it.
//
// Real source path on purpose: `src/lib/*` is a re-export shim after #203, so
// reading one would match nothing and pass while checking nothing.
const ROUTE = "src/app/api/points/comps/route.ts";
const raw = readFileSync(ROUTE, "utf8");

/**
 * Comments out before matching.
 *
 * This file's checks are "the route must NOT do X", and the route documents at
 * length exactly which X it must not do - naming `total30d`, `MIN_VOLUME_30D`
 * and the failure they caused. Matching raw text makes a correct file fail on
 * its own explanation, which teaches the next person to delete the comment or
 * weaken the check. Five other test files here strip for the same reason.
 */
const strip = (s: string) =>
  s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ");
const src = strip(raw);

describe("the comparables route stays aligned with the cache it reads", () => {
  it("declares a literal revalidate", () => {
    expect(src).toMatch(/^export const revalidate = \d+;/m);
  });

  it("that literal equals the shared llama overview TTL", () => {
    const m = src.match(/^export const revalidate = (\d+);/m);
    expect(m, `no literal revalidate found in ${ROUTE}`).toBeTruthy();
    expect(
      Number(m![1]),
      `${ROUTE} declares ${m![1]}s but llamaOverview caches for ${OVERVIEW_TTL}s. ` +
        "Next takes the minimum across the segment, so the longer number is a lie. " +
        "Change both together, or change neither."
    ).toBe(OVERVIEW_TTL);
  });

  it("sets an edge Cache-Control that AGREES with the revalidate export", () => {
    // Trap 0: `s-maxage` is what the Vercel edge honours, not `revalidate`.
    //
    // ⚠️ This asserted the TEMPLATE form, `s-maxage=${revalidate}`, on the
    // reasoning that building the header from the const means they cannot
    // disagree. True, and still the wrong call: a template literal is invisible
    // to `markets-poll-alignment.test.ts`, which greps the success-path
    // `s-maxage` to check it against the client poll. So the one number that
    // actually governs the CDN became the one number nothing could verify.
    //
    // Literal in the route, and this test compares the two values instead - it
    // fails just as loudly if they drift, and the alignment check can read it.
    const win = Number(src.match(/^export const revalidate = (\d+);/m)?.[1]);
    const edge = Number(src.match(/"public, s-maxage=(\d+), stale-while-revalidate=(\d+)"/)?.[1]);
    const swr = Number(src.match(/"public, s-maxage=(\d+), stale-while-revalidate=(\d+)"/)?.[2]);
    expect(win).toBe(320);
    expect(edge, "s-maxage must equal the revalidate export").toBe(win);
    expect(swr).toBeGreaterThan(edge);
  });

  it("is honest about BEING polled, and points at the test that guards it", () => {
    // This asserted /NOT POLLED/ while the route genuinely was not. It is now,
    // so the note has to say the opposite and name the poll, or the next reader
    // adds a second one on the strength of a stale comment.
    //
    // `raw`, not `src`: the one assertion here that is ABOUT a comment, so it is
    // the one that must not have comments stripped first.
    expect(raw).toMatch(/POLLED, at 300s/);
    expect(raw).toMatch(/markets-poll-alignment\.test\.ts/);
    expect(raw).not.toMatch(/⚠️ NOT POLLED/);
  });

  it("never serves a stale-forever response when the data is missing", () => {
    // An empty result cached for five minutes turns one upstream blip into five
    // minutes of an empty page for everyone.
    expect(src).toMatch(/"public, s-maxage=30"/);
  });
});

describe("the comparables route cannot invent an FDV", () => {
  it("matches peers by name, never by a hand-written CoinGecko id", () => {
    // A wrong id silently attaches another project's multi-billion valuation to
    // a venue, and nothing about reading it would reveal that. A name mismatch
    // produces no FDV instead - visible, and honest.
    expect(src).not.toMatch(/coingeckoId:\s*"[a-z0-9-]+"/);
    expect(src).toMatch(/const NAME_ALIASES: Record<string, string>/);
  });

  it("leaves fdv null rather than 0 when no peer matches", () => {
    // 0 would sort as the cheapest comparable and drag the median down while
    // looking like a real datapoint. `null` is filtered out by buildComparables.
    expect(src).toMatch(/fdv: match\?\.fdv \?\? null/);
  });
});

describe("an unverified upstream field may add capability, never gate it", () => {
  // ⚠️ This shipped, and the symptom was the page saying "Data unavailable"
  // with nothing anywhere explaining why.
  //
  // `total7d` / `total30d` were added to `OverviewRow` from an API this
  // environment cannot reach to verify. The route then filtered AND sorted the
  // entire venue list on `total30d`. When the upstream does not return that
  // field every row reads 0, every venue is filtered out, `live` is false, and
  // the comparables engine has nothing to show - on a response that contained
  // forty perfectly good venues.
  //
  // `total24h` is the field `/api/markets/perp` has used in production for
  // months, so it is the one known to exist. Longer windows are enrichment.
  it("filters and sorts on the field that is known to exist", () => {
    expect(src).toMatch(/const MIN_VOLUME_24H = /);
    // Untyped on the `p: any` spelling: the rows are `OverviewRow` now that
    // both paths run through `reduceOverview`. What matters is which FIELD
    // decides inclusion and order, not how the parameter is annotated.
    expect(src).toMatch(/\.filter\(\(p\)? *:? *(any)?\)? *=> \(Number\(p\.total24h\) \|\| 0\) >= MIN_VOLUME_24H\)/);
    expect(src).toMatch(/\.sort\(\(a(: any)?, b(: any)?\) => \(Number\(b\.total24h\)/);
  });

  it("no longer lets a longer window decide who is included", () => {
    expect(src).not.toMatch(/MIN_VOLUME_30D/);
    expect(src).not.toMatch(/filter[\s\S]{0,60}total30d/);
  });

  it("still reads the longer windows when they are there", () => {
    // Dropping them entirely would be the opposite overcorrection: when
    // DefiLlama does return 30d, comparing on it is better than on one noisy
    // day, and the engine should use it.
    expect(src).toMatch(/volume7d: Number\(p\.total7d\) \|\| 0/);
    expect(src).toMatch(/volume30d: Number\(p\.total30d\) \|\| 0/);
  });

  it("tells the client which windows actually arrived", () => {
    // So the UI offers only metrics that can answer. A selector that renders an
    // empty table reads as broken when the truth is "nobody publishes that".
    expect(src).toMatch(/const windows = \{/);
    for (const k of ["volume24h", "volume7d", "volume30d", "openInterest"]) {
      expect(src, `windows is missing ${k}`).toMatch(new RegExp(`${k}: venues\\.some`));
    }
    // `diag` joined the payload after this route shipped a failure the page
    // could only describe as "Data unavailable". Pin the fields, not the exact
    // object literal, so adding an honest one is not a test failure.
    expect(src).toMatch(/NextResponse\.json\(\s*\{ venues, live, pricedCount, windows, diag, ts: Date\.now\(\) \}/);
  });
});

describe("the client cannot ask for a window that is not there", () => {
  const client = readFileSync("src/modules/points/components/PointsClient.tsx", "utf8");
  const engine = readFileSync("src/modules/points/components/CompsEngine.tsx", "utf8");

  it("falls back to the widest window that is present", () => {
    // `volume30d` was the hard-coded default, so the same missing field emptied
    // the comparable set one layer above the filter.
    expect(client).toMatch(/windows\[form\.metric\] === false/);
    expect(client).toMatch(/\["volume30d", "volume7d", "volume24h", "openInterest"\]/);
  });

  it("offers only the windows the payload reported", () => {
    expect(engine).toMatch(/windows\[m\.value\] \?\? venues\.some/);
  });
});

describe("each programme is its own calculation", () => {
  const client = readFileSync("src/modules/points/components/PointsClient.tsx", "utf8");
  const section = readFileSync("src/modules/points/components/ProgramSection.tsx", "utf8");
  const value = readFileSync("src/modules/points/components/ValuePanel.tsx", "utf8");

  it("keeps inputs per programme rather than one shared set", () => {
    // Shared inputs meant switching from Sodex to RiseX silently reinterpreted
    // your Sodex points against RiseX's pool, and the two could never be seen
    // at once - which is the comparison anyone farming both wants.
    expect(client).toMatch(/progs: Record<string, Partial<ProgState>>/);
    expect(client).toMatch(/function progStateOf\(/);
  });

  it("seeds each one from its own published scenario", () => {
    expect(client).toMatch(/totalPoints: saved\.totalPoints \?\? String\(p\.scenario\.totalPoints\)/);
    expect(client).toMatch(/allocPct: saved\.allocPct \?\? String\(p\.scenario\.allocationPctOfSupply\)/);
  });

  it("renders the registry's scenario quick-picks under the field each sets", () => {
    // These existed in the /tools calculator and were lost in the move. They
    // are the difference between "type a number" and "compare the scenarios
    // the programme actually published".
    expect(section).toMatch(/allocationScenarios=\{program\.scenario\.allocationScenarios\}/);
    expect(section).toMatch(/fdvScenarios=\{program\.scenario\.fdvScenariosUsd\}/);
    expect(value).toMatch(/function ScenarioChip/);
  });

  it("a scenario click breaks the live anchor instead of being undone by it", () => {
    // While linked, the FDV is derived every render. Setting it without
    // clearing the link would be reverted on the next render and the button
    // would look broken.
    expect(value).toMatch(/if \(linked\) set\("fdvLinked", false\);\s*\n\s*set\("fdv", String\(v\)\)/);
  });

  it("gives each section a stable anchor to jump to", () => {
    expect(section).toMatch(/id=\{`programme-\$\{program\.id\}`\}/);
    const panel = readFileSync("src/modules/points/components/ProgramPanel.tsx", "utf8");
    expect(panel).toMatch(/href=\{`#programme-\$\{p\.id\}`\}/);
  });
});

describe("a venue is measured on a window IT has, not one the response has", () => {
  // ⚠️ This is the bug that made the comparables panel show nothing, and it
  // survived two rounds of guessing at the route because it was never in the
  // route.
  //
  // `buildComparables` correctly returns [] when the TARGET's own metric is 0 -
  // a ratio against zero says nothing. The explorer's entire purpose is valuing
  // an UNLISTED venue, so it auto-selects the first venue with no FDV: the
  // newest one on the page. The default window was 30-day volume. **A venue new
  // enough to be unlisted has no 30 days of history.** So the panel picked the
  // one venue guaranteed to score zero on the window it then measured, every
  // single time, and rendered "Data unavailable" with live data in hand.
  //
  // The route-level `windows` map could not catch it: it answers "did ANY venue
  // populate this window", not "did THIS one".
  const listed = (name: string, v24: number, v30: number, fdv: number): CompVenue => ({
    slug: name.toLowerCase(),
    name,
    logo: null,
    volume24h: v24,
    volume7d: v24 * 7,
    volume30d: v30,
    openInterest: 0,
    fdv,
    coingeckoId: null,
  });
  /** Launched this week: real volume, no history, no token. */
  const fresh: CompVenue = {
    slug: "fresh-venue",
    name: "Fresh Venue",
    logo: null,
    volume24h: 40_000_000,
    volume7d: 0,
    volume30d: 0,
    openInterest: 0,
    fdv: null,
    coingeckoId: null,
  };
  const peers = [fresh, listed("Hyperliquid", 8e9, 240e9, 40e9), listed("dYdX", 1e9, 30e9, 2e9)];

  it("reproduces the empty set the old behaviour produced", () => {
    // Guard on the premise: if this ever stops being empty the test below is
    // no longer testing anything.
    expect(buildComparables(fresh, peers, "volume30d")).toHaveLength(0);
  });

  it("widens to the widest window the target can actually answer on", () => {
    const m = pickMetricFor(fresh, "volume30d");
    expect(m).toBe("volume24h");
    expect(buildComparables(fresh, peers, m).length).toBeGreaterThan(0);
  });

  it("leaves an explicit choice alone while it still works", () => {
    // Silently overriding a window the reader picked, and which the data can
    // answer, would be its own bug.
    expect(pickMetricFor(peers[1], "volume30d")).toBe("volume30d");
    expect(pickMetricFor(peers[1], "volume24h")).toBe("volume24h");
  });

  it("falls back to the preferred window when the venue has no data at all", () => {
    const empty: CompVenue = { ...fresh, volume24h: 0 };
    expect(pickMetricFor(empty, "volume7d")).toBe("volume7d");
    expect(pickMetricFor(null, "volume7d")).toBe("volume7d");
  });

  it("is what the client actually calls, for the explorer AND each programme", () => {
    const client = readFileSync("src/modules/points/components/PointsClient.tsx", "utf8");
    expect(client).toMatch(/pickMetricFor\(explorerTarget, metric\)/);
    expect(client).toMatch(/buildComparables\(p\.venue, venues, pickMetricFor\(p\.venue, metric\)\)/);
  });

  it("tells the reader when the window was widened", () => {
    // A number quietly computed on a different window than the one highlighted
    // is how a correct figure becomes untrustworthy.
    const comps = readFileSync("src/modules/points/components/CompsEngine.tsx", "utf8");
    expect(comps).toMatch(/requestedMetric !== metric/);
  });
});

describe("the route reads its heavy upstream only through the shared cache", () => {
  it("has no direct llama fetch of its own", () => {
    // A direct `api.llama.fi/overview/derivatives` fetch was added here as a
    // retry for an empty cached list. It was wrong twice over: that body is one
    // of the four moved behind `unstable_cache` for being over Next's ~2 MB
    // data-cache ceiling, so an uncached fetch re-parses megabytes on a request
    // path (Fluid Active CPU, cost-check trap 2) - and the empty comparables
    // panel it was meant to fix was never caused by an empty protocol list.
    //
    // `markets-poll-alignment.test.ts` refuses it by name too. This states the
    // same rule where the route's own reader will see it.
    expect(src).not.toMatch(/fetch\(\s*["'`]https:\/\/api\.llama\.fi/);
    expect(src).toMatch(/await llamaOverview\("derivatives"\)/);
  });

  it("cannot throw on a missing name", () => {
    expect(src).toMatch(/NAME_ALIASES\[String\(p\.name \?\? ""\)\.toLowerCase\(\)\]/);
  });

  it("states the success-path s-maxage as a literal the edge check can read", () => {
    // ⚠️ The edge honours this header, NOT `export const revalidate`
    // (cost-check trap 0). It was written as `s-maxage=${revalidate}`, which is
    // invisible to the alignment test's regex - so the one number that actually
    // governs the CDN would have been the one number nothing verified.
    expect(src).toMatch(/"public, s-maxage=320, stale-while-revalidate=420"/);
  });
});
