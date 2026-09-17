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
const src = readFileSync(ROUTE, "utf8");

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
    expect(src).toMatch(/NOT POLLED/);
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
