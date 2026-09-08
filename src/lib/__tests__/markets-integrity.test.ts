import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Markets, first pass. One theme: the hub could show WRONG data as if it were
// right - which on a page of prices is the worst failure mode available to it.
//
// Real source paths on purpose: `src/components/*` and `src/lib/*` are
// re-export shims after #203.
const hub = readFileSync("src/modules/markets/components/MarketsClient.tsx", "utf8");
const perp = readFileSync("src/app/api/markets/perp/route.ts", "utf8");
const coinRoute = readFileSync("src/app/api/markets/coin/[id]/route.ts", "utf8");
const coinPage = readFileSync("src/app/markets/[id]/page.tsx", "utf8");
const strip = (s: string) => s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ");
const H = strip(hub);

describe("a failed feed cannot blank the page", () => {
  it("only replaces data the server vouches for", () => {
    // Every markets route answers a failed upstream with HTTP 200, empty arrays
    // and `live: false` - by design, so the page never shows an error screen.
    // The poller checked only `res.ok`, which is true for exactly that
    // response, so one transient CoinGecko 429 replaced a populated 250-row
    // table with `{ list: [] }` and the Coins tab read "loading…" for 180s.
    expect(H).toMatch(/if \(j\?\.live\) setData\(j\)/);
    expect(H).not.toMatch(/const j = await res\.json\(\);\s*if \(!active\) return;\s*setData\(j\);/);
  });
});

describe("the live badge speaks for the whole page", () => {
  it("is ALL, not ANY", () => {
    // `g.live || d.live || ...` meant one healthy source lit the badge. With
    // /api/markets/global down and coins up, the page said "Live market data"
    // over the global route's hardcoded fallback: a $2.35T market cap and a
    // Fear & Greed of exactly 50, both invented.
    expect(H).toMatch(/const allLive = sources\.every\(Boolean\)/);
    expect(H).not.toMatch(/const anyLive = g\.live \|\| d\.live/);
  });

  it("says how many feeds are behind", () => {
    // "Cached snapshot" alone cannot distinguish one slow feed from an outage.
    expect(H).toMatch(/const staleCount = sources\.filter\(\(v\) => !v\)\.length/);
    expect(H).toMatch(/feed\$\{staleCount === 1 \? "" : "s"\} stale/);
  });
});

describe("perp rows belong to the coin they name", () => {
  it("refuses to zip two arrays of different lengths", () => {
    // Hyperliquid's `metaAndAssetCtxs` joins `universe[i]` to `assetCtxs[i]` by
    // POSITION - that is its documented contract, and it cannot be done any
    // other way here because an assetCtx carries no name to match on.
    //
    // What was missing is what happens when the contract does not hold: the map
    // indexed blindly, so a short or reordered `ctxs` produced a full table
    // whose price, funding and open interest belonged to a different coin, with
    // no throw and no `live: false`.
    expect(strip(perp)).toMatch(/if \(universe\.length !== ctxs\.length\)/);
  });

  it("drops rows with no price", () => {
    // "$0" beside a real funding rate is worse than the row being absent.
    expect(strip(perp)).toMatch(/\.filter\(\(r\) => r\.price > 0 && r\.coin !== "-"\)/);
  });
});

describe("rows are keyed by identity, not by ticker or position", () => {
  it("keys the price flash by coin id", () => {
    // Ticker symbols are not unique in crypto. Two rows sharing one overwrote
    // each other's previous price every poll, so both flashed every tick and
    // the direction was whichever was written last.
    expect(H).toMatch(/prevPrices\.current\.get\(r\.id\)/);
    expect(H).toMatch(/prevPrices\.current\.set\(r\.id, r\.price\)/);
    expect(H).not.toMatch(/prevPrices\.current\.get\(r\.symbol\)/);
  });

  it("de-dupes search results by id", () => {
    // By symbol, a coin sharing a ticker with a top-250 coin was silently
    // dropped - defeating the search route's stated purpose of finding ANY
    // coin, not just the top 250.
    expect(H).toMatch(/const seen = new Set\(local\.map\(\(r\) => r\.id\)\)/);
    expect(H).not.toMatch(/new Set\(local\.map\(\(r\) => r\.symbol\)\)/);
  });

  it("does not key list rows by array index", () => {
    // These lists re-sort on every poll by design, so an index key forces a
    // full unmount/remount and re-downloads each row's logo.
    expect(H).not.toMatch(/key=\{r\.name \+ i\}/);
    expect(H).not.toMatch(/key=\{r\.symbol \+ i\}/);
    // `symbol + rank` could also collide: unranked search results fall back to
    // `i + 1`, so two of them take ranks 1 and 2 alongside the real 1 and 2.
    expect(H).not.toMatch(/key=\{r\.symbol \+ r\.rank\}/);
  });
});

describe("search cannot show the results of a query you moved past", () => {
  it("aborts the in-flight request and guards the response", () => {
    // The cleanup cancelled the TIMER but never the REQUEST, and there was no
    // sequence guard - so of two in-flight searches the slower one won.
    expect(H).toMatch(/const ctrl = new AbortController\(\)/);
    expect(H).toMatch(/signal: ctrl\.signal/);
    expect(H).toMatch(/ctrl\.abort\(\)/);
    expect(H).toMatch(/\.then\(\(j\) => \{ if \(active\) setRemote/);
  });

  it("does not clear `searching` from a stale response", () => {
    // The stale `.finally` flipped it off while the newer request was still
    // running, and the empty state reads `!rows.length && !searching` - so the
    // reader got a false "No coins match" flash mid-typing.
    expect(H).toMatch(/\.finally\(\(\) => \{ if \(active\) setSearching\(false\); \}\)/);
  });
});

describe("the coin route's cache window clears its poll", () => {
  it("is no longer exactly equal to it", () => {
    // markets-poll-alignment.test.ts, in its own words: "Exactly equal is a
    // coin flip: the window expires at the same moment the poll fires, so
    // scheduling jitter decides whether it regenerates."
    const rev = Number(/export const revalidate = (\d+)/.exec(strip(coinRoute))?.[1]);
    expect(rev).toBe(200);
    expect(strip(coinRoute)).toMatch(/s-maxage=200/);
  });
});

describe("an unknown coin is a real 404", () => {
  it("calls notFound", () => {
    // The page had none, so /markets/not-a-real-coin returned 200 with a
    // self-referencing canonical and a client-side error - an indexable soft
    // 404 on what the file itself calls the largest indexable surface on the
    // site - and burned an ISR entry per garbage id visited.
    expect(strip(coinPage)).toContain("notFound()");
  });

  it("only on an explicit upstream 404, never on an outage", () => {
    // `coinMeta` used to collapse every failure to null. 404-ing every real
    // coin page while CoinGecko rate-limits would be a worse bug than the one
    // being fixed, so "missing" and "unknown" are separate answers.
    expect(strip(coinPage)).toMatch(/if \(r\.status === 404\) return "missing"/);
    expect(strip(coinPage)).toMatch(/if \(!r\.ok\) return "unknown"/);
    expect(strip(coinPage)).toMatch(/=== "missing"\) notFound\(\)/);
  });
});
