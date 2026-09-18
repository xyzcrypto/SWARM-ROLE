import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isKnownPerpDex, mergeVenues, normaliseVenue } from "@modules/points/lib/perp-sources";
import { isRadarWorthy, toRadar, venuesNamed, RADAR_CATEGORIES } from "@modules/points/lib/airdrop-radar";
import { NEWS_REVALIDATE } from "@modules/news/lib/news-fetch";
import type { CompVenue } from "@modules/points/lib/points";

// ⚠️ These exist because production finally said what was wrong, and it was not
// what three rounds of guessing had assumed:
//
//     venues from upstream: 0 · past the volume filter: 0 ·
//     priced tokens: 249 · matched: 0 · llama Error
//
// CoinGecko was answering perfectly. DefiLlama was refusing. A single upstream
// being able to blank the whole panel is the real defect, and no amount of
// retrying a refusing host fixes it.
const venue = (name: string, v24: number, fdv: number | null = null): CompVenue => ({
  slug: name.toLowerCase(),
  name,
  logo: null,
  volume24h: v24,
  volume7d: 0,
  volume30d: 0,
  openInterest: 0,
  fdv,
  coingeckoId: null,
});

describe("a second venue source may only ever add venues it can name", () => {
  it("accepts the perp DEXs on the allowlist, however they are spelled", () => {
    expect(isKnownPerpDex("Hyperliquid")).toBe(true);
    expect(isKnownPerpDex("dYdX v4")).toBe(true);
    expect(isKnownPerpDex("Jupiter Perpetual Exchange")).toBe(true);
    expect(isKnownPerpDex("GMX V2")).toBe(true);
    expect(isKnownPerpDex("Vertex Protocol")).toBe(true);
  });

  it("refuses centralised exchanges, which is the whole point", () => {
    // The fallback list mixes CEXs in with perp DEXs. Pricing a points
    // programme against Binance's volume would be the "wrong number presented
    // as right" failure this codebase keeps being bitten by, so the filter is
    // an allowlist and it fails CLOSED.
    for (const cex of ["Binance", "Bybit", "OKX", "Deribit", "Bitget", "Gate.io", "Kraken", "MEXC"]) {
      expect(isKnownPerpDex(cex), `${cex} must not be treated as a perp DEX`).toBe(false);
    }
  });

  it("does not let a prefix match swallow an unrelated name", () => {
    // The prefix rule is capped at two trailing characters precisely so
    // "aster" cannot match "asterisk"-shaped names.
    expect(isKnownPerpDex("Asterisk Labs")).toBe(false);
    expect(isKnownPerpDex("Driftwood Capital")).toBe(false);
    // ...while still accepting the real suffixed spellings it exists for.
    expect(isKnownPerpDex("GMXv2")).toBe(true);
  });

  it("normalises the decoration two registries disagree about", () => {
    expect(normaliseVenue("Jupiter Perpetual Exchange")).toBe("jupiter");
    expect(normaliseVenue("Vertex Protocol")).toBe("vertex");
    expect(normaliseVenue("dYdX v4")).toBe("dydx");
  });
});

describe("merging sources prefers the richer one", () => {
  it("keeps the first source's row on a collision", () => {
    // The primary carries 7d and 30d windows; a fallback row has 24h only.
    // Replacing a rich row with a poor one would silently narrow the metrics
    // the page can offer.
    const primary = [{ ...venue("Hyperliquid", 8e9, 40e9), volume30d: 240e9 }];
    const fallback = [venue("hyperliquid", 7.9e9)];
    const merged = mergeVenues(primary, fallback);
    expect(merged).toHaveLength(1);
    expect(merged[0].volume30d).toBe(240e9);
    expect(merged[0].fdv).toBe(40e9);
  });

  it("adds venues the primary did not have", () => {
    const merged = mergeVenues([venue("Hyperliquid", 8e9)], [venue("Paradex", 3e8)]);
    expect(merged.map((v) => v.name).sort()).toEqual(["Hyperliquid", "Paradex"]);
  });

  it("matches across spellings rather than on the raw name", () => {
    // "GMX V2" and "GMX" are one venue. Keying on the raw string would list it
    // twice and double-count it in the median.
    expect(mergeVenues([venue("GMX V2", 2e8)], [venue("GMX", 1e8)])).toHaveLength(1);
  });
});

describe("the radar is a filter over the news pipeline, not a new upstream", () => {
  const src = readFileSync("src/app/api/points/radar/route.ts", "utf8");

  it("reuses getNewsPage instead of fetching feeds itself", () => {
    // Twenty feeds are already fetched, parsed, deduped and cached for /news.
    // A second fetch would double a cost the site already pays, and a second
    // parser would be a second thing to keep correct - `parseFeed` is hardened
    // against CDATA, Atom, entity escaping and malformed dates.
    expect(src).toMatch(/getNewsPage\(/);
    expect(src).not.toMatch(/fetch\(\s*["'`]https?:/);
  });

  it("declares the window the shared cache actually imposes", () => {
    // Trap 1b: Next takes the MINIMUM revalidate across a segment, and an
    // `unstable_cache` TTL counts. Declaring longer than NEWS_REVALIDATE would
    // be silently truncated and this file would disagree with the route table.
    const m = src.match(/^export const revalidate = (\d+);/m);
    expect(m).toBeTruthy();
    expect(Number(m![1])).toBe(NEWS_REVALIDATE);
  });

  it("sets a literal edge header the alignment check can read", () => {
    // Trap 0: the edge honours this, not the export.
    expect(src).toMatch(/"public, s-maxage=120, stale-while-revalidate=300"/);
    expect(src).toMatch(/"public, s-maxage=30"/);
  });

  it("is honest about BEING polled, and names the guard", () => {
    // This asserted /NOT POLLED/ while the route genuinely was not. It is now -
    // the press lane had no live path at all while the desk lane broadcast on
    // write - so the note has to say the opposite and name the poll, or the next
    // reader adds a second one on the strength of a stale comment.
    expect(src).toMatch(/POLLED, at 90s/);
    expect(src).toMatch(/markets-poll-alignment\.test\.ts/);
    expect(src).not.toMatch(/⚠️ NOT POLLED/);
  });
});

describe("the radar keeps the page's subject", () => {
  const item = (title: string, categories: string[] = [], summary = "") => ({
    id: title,
    title,
    url: `https://example.com/${encodeURIComponent(title)}`,
    summary,
    source: "The Block",
    sourceIcon: null,
    image: null,
    publishedAt: Date.now(),
    category: categories[0] ?? "Market News",
    categories,
    sentiment: "neutral" as const,
    impact: "Low" as const,
    tokens: [],
  });

  it("takes anything the shared classifier already tagged for this page", () => {
    for (const c of RADAR_CATEGORIES) {
      expect(isRadarWorthy(item("Something happened", [c]))).toBe(true);
    }
  });

  it("also catches the two events a farmer plans around", () => {
    // Both are routinely written without the word "airdrop" anywhere near them.
    expect(isRadarWorthy(item("Sodex snapshot is Friday", ["Market News"]))).toBe(true);
    expect(isRadarWorthy(item("Aster confirms TGE date", ["Market News"]))).toBe(true);
  });

  it("leaves general crypto news out", () => {
    // A broad keyword list turns a curated feed into a firehose, which is the
    // failure mode of every airdrop tracker and the reason this page exists.
    expect(isRadarWorthy(item("Bitcoin ETF sees record inflows", ["Market News"]))).toBe(false);
    expect(isRadarWorthy(item("SEC delays a decision", ["Regulations"]))).toBe(false);
  });

  it("tags the venues a story names, and only those", () => {
    expect(venuesNamed("Hyperliquid and Aster both announced points")).toEqual(
      expect.arrayContaining(["Hyperliquid", "Aster"])
    );
    // Word boundaries: a longer word that merely contains a venue name must not
    // tag it, or a reader is sent to the wrong programme's section.
    expect(venuesNamed("an asterisk in the docs")).toEqual([]);
  });

  it("carries the story's picture through", () => {
    // ⚠️ This shape used to drop `image` on the floor, so the press lane could
    // never show one however good the feed was - and the band's own renderer
    // had `image: null` hard-coded to match, which is the kind of agreement
    // between two files that makes a missing feature look intentional.
    const withPic = { ...item("Aster season 3", ["Airdrops"]), image: "https://cdn.example.com/a.jpg" };
    expect(toRadar([withPic])[0].image).toBe("https://cdn.example.com/a.jpg");
  });

  it("refuses an image url that is not http(s)", () => {
    // This value is handed straight to an <img src>. A renderer should not be
    // the first place a scheme is checked, and a `data:` URL here would also be
    // serialised into the response thirty times over (cost-check, trap 4).
    for (const bad of ["javascript:alert(1)", "data:image/png;base64,AAAA", "//evil.example/x.png"]) {
      expect(toRadar([{ ...item("Sodex snapshot", ["Airdrops"]), image: bad }])[0].image).toBeNull();
    }
  });

  it("orders by recency rather than by a general news impact score", () => {
    const old = { ...item("Old airdrop news", ["Airdrops"]), publishedAt: 1_000 };
    const fresh = { ...item("New airdrop news", ["Airdrops"]), publishedAt: 9_000 };
    expect(toRadar([old, fresh]).map((i) => i.title)).toEqual(["New airdrop news", "Old airdrop news"]);
  });
});
