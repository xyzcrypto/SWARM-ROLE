import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { OVERVIEW_TTL } from "@modules/markets/lib/llama";

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

  it("sets an edge Cache-Control derived from the same number", () => {
    // Trap 0: `s-maxage` is what the Vercel edge honours, not `revalidate`.
    // Building the header from the const means they cannot disagree.
    expect(src).toMatch(/s-maxage=\$\{revalidate\}/);
    expect(src).toMatch(/stale-while-revalidate=\$\{revalidate \+ \d+\}/);
  });

  it("is honest about not being polled", () => {
    // If a poll is ever added it needs a TARGETS entry in
    // markets-poll-alignment.test.ts. This keeps the note that says so.
    //
    // `raw`, not `src`: this is the one assertion here that is ABOUT a comment,
    // so it is the one that must not have comments stripped first.
    expect(raw).toMatch(/NOT POLLED/);
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
    expect(src).toMatch(/\.filter\(\(p: any\) => \(Number\(p\.total24h\) \|\| 0\) >= MIN_VOLUME_24H\)/);
    expect(src).toMatch(/\.sort\(\(a: any, b: any\) => \(Number\(b\.total24h\)/);
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
    expect(src).toMatch(/\{ venues, live, pricedCount, windows, ts: Date\.now\(\) \}/);
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
