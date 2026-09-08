import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Markets, design pass. Everything here was found by rendering the page and
// looking at it, and every one is a measurable inconsistency rather than a
// matter of taste - which is the only kind of design finding worth a test.
//
// Real source paths on purpose: `src/components/*` and `src/lib/*` are
// re-export shims after #203.
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const M = strip(readFileSync("src/modules/markets/components/MarketsClient.tsx", "utf8"));
const page = strip(readFileSync("src/app/markets/page.tsx", "utf8"));
const header = strip(readFileSync("src/shared/components/PageHeader.tsx", "utf8"));

describe("the colour rule holds", () => {
  // design-system skill, in its own words: gold = brand/identity, mint =
  // action + POSITIVE data, red = negative data.
  it("a falling sparkline is red, not the brand colour", () => {
    // It was `up ? mint : gold`, so a coin down 12% drew its 7-day line in the
    // wordmark's colour - directly beside that same row's red percentages.
    expect(M).toMatch(/stroke=\{up \? "var\(--chart-mint\)" : "#ef4444"\}/);
    expect(M).not.toMatch(/up \? "var\(--chart-mint\)" : "var\(--chart-gold\)"/);
  });

  it("neutral totals are not painted mint or gold", () => {
    // `accent` coloured the value across eight call sites - TVL mint,
    // Stablecoin Mcap gold, Perp Volume gold, Open Interest mint. A stablecoin
    // market cap is neither brand identity nor positive data; it is a number.
    expect(M).not.toMatch(/accent=\{?"(mint|gold)"/);
    expect(M).not.toMatch(/accent\?: "mint" \| "gold"/);
    expect(M).toMatch(/function StatCardMini\(\{ label, value, sub, trend \}/);
  });
});

describe("the two KPI rows speak one size language", () => {
  // They sit directly on top of each other showing the same class of thing, and
  // disagreed on every axis: p-5 vs p-4, text-2xl vs text-xl, gap-4 vs gap-3.
  it("same padding as the Tile above it", () => {
    expect(M).toMatch(/function StatCardMini[\s\S]{0,400}?"surface lift rounded-2xl p-4"/);
    expect(M).toMatch(/function Tile[\s\S]{0,300}?"surface lift rounded-2xl p-4"/);
  });

  it("same value size", () => {
    expect(M).toMatch(/function StatCardMini[\s\S]{0,500}?mono mt-1\.5 text-xl font-bold text-zinc-50/);
    expect(M).toMatch(/function Tile[\s\S]{0,400}?mono mt-1\.5 text-xl font-bold text-zinc-50/);
  });

  it("same row gap", () => {
    expect(M).not.toMatch(/grid grid-cols-\d gap-4 sm:grid-cols-2 lg:grid-cols-3/);
  });
});

describe("the KPI strip fits a phone", () => {
  it("is two-up on mobile, not one", () => {
    // One column gave each tile a full 358px row for a short number like
    // "$2.31T": five tiles, ~600px of scrolling, and the coin table pushed
    // entirely off the first screen of a 390x844 phone.
    expect(M).toMatch(/className="grid grid-cols-2 gap-3 lg:grid-cols-5"/);
    expect(M).toMatch(/className="grid grid-cols-2 gap-3 lg:grid-cols-3"/);
    expect(M).not.toMatch(/grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5/);
  });
});

describe("the page makes one claim about freshness, not two", () => {
  it("drops the static eyebrow", () => {
    // "Live Data" as a fixed pill sat 20px above the status line MarketsClient
    // renders - and the fixed one keeps saying "Live Data" while every feed is
    // a cached snapshot, which is the class of lie #316 was about.
    expect(page).not.toMatch(/eyebrow="Live Data"/);
  });

  it("keeps the one that knows the difference", () => {
    expect(M).toMatch(/"Cached snapshot"/);
    expect(M).toMatch(/feed\$\{staleCount === 1 \? "" : "s"\} stale/);
  });

  it("PageHeader tolerates having no eyebrow", () => {
    // Required prop before this, so omitting it was a type error rather than a
    // choice. Every other page still passes one.
    expect(header).toMatch(/eyebrow\?: ReactNode;/);
    expect(header).toMatch(/\{eyebrow && \(/);
  });
});

describe("the coins table shows prices on a phone", () => {
  // The worst thing on the page, and it was one class. The table already hid
  // Market Cap, Volume and the sparkline at small widths - and then forced
  // itself 720px wide anyway, so a 390px phone rendered the first 390px of it:
  // rank and name. The PRICE, the one number this page exists for, sat
  // off-screen to the right with nothing indicating it was there.
  it("does not force a width the screen cannot show", () => {
    expect(M).toMatch(/<table className="w-full text-sm md:min-w-\[720px\]">/);
    expect(M).not.toMatch(/className="w-full min-w-\[720px\] text-sm"/);
  });

  it("keeps price and 24h at every width", () => {
    // These two are the whole point of the table; they must never be the
    // columns that get dropped.
    expect(M).toMatch(/<SortTh label="Price" col="price" sort=\{sort\} onSort=\{onSort\} \/>/);
    expect(M).toMatch(/<SortTh label="24h" col="change24h" sort=\{sort\} onSort=\{onSort\} \/>/);
    expect(M).toMatch(/<ChangeCell v=\{r\.change24h\} \/>/);
  });

  it("drops 1h and 7d instead, and drops the cell with its header", () => {
    // A hidden header with a visible cell shifts every column after it.
    expect(M).toMatch(/label="1h"[^/]*className="hidden sm:table-cell"/);
    expect(M).toMatch(/label="7d"[^/]*className="hidden sm:table-cell"/);
    expect(M).toMatch(/<ChangeCell v=\{r\.change1h\} className="hidden sm:table-cell" \/>/);
    expect(M).toMatch(/<ChangeCell v=\{r\.change7d\} className="hidden sm:table-cell" \/>/);
  });

  it("ChangeCell can be hidden at a breakpoint at all", () => {
    expect(M).toMatch(/function ChangeCell\(\{ v, className \}/);
  });
});

describe("how far below its all-time high", () => {
  const route = strip(readFileSync("src/app/api/markets/coins/route.ts", "utf8"));
  const search = strip(readFileSync("src/app/api/markets/search/route.ts", "utf8"));
  const lib = strip(readFileSync("src/modules/markets/lib/markets.ts", "utf8"));

  it("costs no extra request", () => {
    // `/coins/markets` returns `ath` and `ath_change_percentage` on every row.
    // Both were already in the response being parsed and were dropped at the
    // `.map()`, so this is free - which is why it could be added at all on a
    // plan that has already had a usage overage.
    expect(route).toMatch(/ath: Number\(d\.ath\) \|\| 0/);
    expect(route).toMatch(/athChange: Number\(d\.ath_change_percentage\) \|\| 0/);
    // No new upstream call was introduced alongside it.
    expect((route.match(/https:\/\/api\.coingecko\.com/g) ?? []).length).toBeLessThanOrEqual(2);
  });

  it("a searched coin carries the same columns as a listed one", () => {
    expect(search).toMatch(/ath: Number\(d\.ath\) \|\| 0/);
    expect(search).toMatch(/athChange: Number\(d\.ath_change_percentage\) \|\| 0/);
  });

  it("is sortable", () => {
    // "Which of these is furthest from its high" is the question the column
    // exists to answer, and it is useless without ordering.
    expect(lib).toMatch(/\| "athChange";/);
    expect(M).toMatch(/label="From ATH" col="athChange"/);
  });

  it("is not painted red", () => {
    // Every coin is at or below its high, so an all-red column carries no
    // signal - the rule is red for negative MOVEMENT, and this is a distance.
    // A coin AT its high is the one thing worth colouring.
    expect(M).toMatch(/r\.athChange >= 0 \? "text-mint-400" : "text-zinc-400"/);
  });
});

describe("category filter", () => {
  const route = strip(readFileSync("src/app/api/markets/category/route.ts", "utf8"));
  const lib = strip(readFileSync("src/modules/markets/lib/markets.ts", "utf8"));

  it("costs nothing until someone actually filters", () => {
    // The whole reason it is a separate route rather than part of the coins
    // payload: readers who never touch a chip make no request at all. Verified
    // in a browser too - 0 requests until a chip is pressed, then exactly 1.
    expect(M).toMatch(/useEffect\(\(\) => \{\s*if \(!catFilter\) return;/);
  });

  it("only asks for categories it offers", () => {
    // The id is interpolated into an upstream URL, so the accepted set is
    // closed rather than sanitised.
    expect(route).toMatch(/const ALLOWED = new Set<string>\(MARKET_CATEGORIES\.map\(\(c\) => c\.id\)\)/);
    expect(route).toMatch(/if \(!ALLOWED\.has\(id\)\)/);
  });

  it("keeps the shared constant out of the route", () => {
    // A client importing a route module drags `NextResponse` into the browser
    // bundle - the class of mistake `env.ts` gained `server-only` to prevent.
    expect(lib).toMatch(/export const MARKET_CATEGORIES = \[/);
    expect(M).not.toMatch(/from "@\/app\/api\//);
  });

  it("matches the coins window it filters", () => {
    // A shorter window here would add regenerations without making the filtered
    // table any fresher than the rows it filters.
    expect(route).toMatch(/export const revalidate = 200;/);
    expect(route).toMatch(/s-maxage=200/);
  });

  it("only trusts a payload the route vouches for", () => {
    expect(M).toMatch(/if \(j\?\.live && Array\.isArray\(j\.ids\)\)/);
  });

  it("says so when a category has nothing in the top 250", () => {
    // Otherwise an empty table looks broken rather than correct.
    expect(M).toMatch(/No top-250 coin is in this category right now\./);
  });

  it("aborts a filter the reader moved past", () => {
    expect(M).toMatch(/return \(\) => \{ active = false; ctrl\.abort\(\); \};/);
  });
});
