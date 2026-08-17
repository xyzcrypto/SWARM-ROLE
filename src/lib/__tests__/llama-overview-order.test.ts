import { describe, expect, it } from "vitest";
import { reduceOverview } from "@modules/markets/lib/llama";

// `overview/*` bodies are over 2 MB, so `llama.ts` caches a reduced form of them
// instead. What it reduces AWAY matters, because two very different consumers
// read the same rows:
//
//   - `/api/markets/{dex,perp}` run `topBy(..., n)`, so they sort for themselves
//   - `sitemap.ts` takes the FIRST 40 rows in the API's own order, and turns each
//     into a published `/markets/protocol/<type>/<slug>` URL
//
// So sorting or truncating inside the shared reducer silently republishes a
// different sitemap. An earlier version of this function did both.

/** Deliberately NOT in descending `total24h` order - that is the whole point. */
const BODY = {
  total24h: 999,
  protocols: [
    { slug: "alpha", name: "Alpha", total24h: 10, change_1d: 1, logo: "a.png" },
    { slug: "beta", name: "Beta", total24h: 500, change_1d: -2, logo: null },
    { module: "gamma-mod", name: "Gamma", total24h: 50 },
    { slug: "delta", name: "Delta", total24h: 300 },
  ],
};

describe("reduceOverview preserves what its consumers depend on", () => {
  it("keeps the upstream's original order", () => {
    expect(reduceOverview(BODY).protocols.map((p) => p.name)).toEqual(["Alpha", "Beta", "Gamma", "Delta"]);
  });

  it("keeps every row - no truncation", () => {
    const many = { protocols: Array.from({ length: 750 }, (_, i) => ({ slug: `p${i}`, name: `P${i}`, total24h: i })) };
    expect(reduceOverview(many).protocols).toHaveLength(750);
  });

  // sitemap.ts builds its URL from `slug ?? module`, so dropping either field
  // would silently shorten the sitemap rather than fail.
  it("carries slug AND module through, un-normalised", () => {
    const rows = reduceOverview(BODY).protocols;
    expect(rows[0]!.slug).toBe("alpha");
    expect(rows[2]!.slug).toBeNull();
    expect(rows[2]!.module).toBe("gamma-mod");
  });

  it("normalises the numeric fields the markets routes read", () => {
    const rows = reduceOverview(BODY).protocols;
    expect(rows[1]).toMatchObject({ total24h: 500, change1d: -2, logo: null });
    expect(rows[3]!.change1d).toBe(0); // missing change_1d must not be NaN
  });

  it("prefers the API's own aggregate, and sums when it is absent", () => {
    expect(reduceOverview(BODY).total24h).toBe(999);
    expect(reduceOverview({ protocols: BODY.protocols }).total24h).toBe(860);
  });

  it("never throws on a malformed body", () => {
    for (const bad of [null, {}, { protocols: null }, { protocols: "nope" }]) {
      expect(reduceOverview(bad).protocols).toEqual([]);
    }
  });
});
