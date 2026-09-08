import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// The rest of the news bugs, plus the data the feed already carries and never
// showed. Nothing here needed a new fetch or a new column - every value was
// already computed and shipped to the client, and thrown away on arrival.
//
// Verified in a browser at 390x844 with the feed stubbed:
//
//     <time dateTime="2026-09-05T17:51:42.656Z" title=...>just now</time>
//     secondary categories rendered: ["Security & Exploits", "DeFi"]   (capped at 2)
//     source is a button: true      token is a button: true
//
// Real source paths on purpose: `src/components/*` and `src/lib/*` are
// re-export shims after #203.
const client = readFileSync("src/modules/news/components/NewsClient.tsx", "utf8");
const social = readFileSync("src/modules/community/components/NewsSocial.tsx", "utf8");
const fetchLib = readFileSync("src/modules/news/lib/news-fetch.ts", "utf8");
const readPage = readFileSync("src/app/news/read/page.tsx", "utf8");
const saved = readFileSync("src/app/api/news/saved/route.ts", "utf8");
const strip = (s: string) => s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ");
const N = strip(client);
const S = strip(social);

describe("a shared link finds its story", () => {
  it("searches the whole pool, not one page of it", () => {
    // `getNewsPage`'s pageSize is CLAMPED to 30, so this was only ever looking
    // at the newest 30 stories - a link shared for anything older fell through
    // to a stub titled "News on XYZ Crypto" within minutes.
    expect(strip(fetchLib)).toMatch(/export async function findNewsByUrl\(url: string\)/);
    expect(strip(readPage)).toContain("findNewsByUrl(url)");
    expect(strip(readPage)).not.toMatch(/getNewsPage\(\{ pageSize: 30 \}\)/);
  });

  it("costs no extra fetch", () => {
    // The same unstable_cache entry the feed is served from, so this is a
    // lookup in memory that is already warm.
    expect(strip(fetchLib)).toMatch(/findNewsByUrl[\s\S]{0,200}await getClassifiedItems\(\)/);
  });
});

describe("the like counter and comment delete are honest", () => {
  it("does not read a stale count from the render closure", () => {
    // `setLikes(j.count ?? likes)` read `likes` from BEFORE the optimistic bump,
    // so a response with no count silently rolled the counter back by one.
    expect(S).toMatch(/setLikes\(\(n\) => \(typeof j\.count === "number" \? j\.count : n\)\)/);
    expect(S).not.toMatch(/setLikes\(j\.count \?\? likes\)/);
  });

  it("puts a failed comment delete back", () => {
    // It removed the comment from view, left it on the server, and swallowed
    // the error - so it reappeared on the next load with nothing saying why.
    expect(S).toMatch(/if \(!r\.ok\) setComments\(snapshot\)/);
    expect(S).toMatch(/catch \{\s*setComments\(snapshot\);/);
    // Snapshot taken inside the updater, so a comment that arrived since this
    // render is not lost by the rollback.
    expect(S).toMatch(/setComments\(\(c\) => \{\s*snapshot = c;/);
  });
});

describe("saved stories look like the feed they came from", () => {
  it("derives the favicon from the story's own url", () => {
    // `sourceIcon: null` made every Saved card lose its publisher icon, while
    // the comment above it claimed the tab "renders identically to the live
    // feed". The icon is a function of the domain, so there was nothing to store.
    expect(strip(saved)).toMatch(/sourceIcon: iconFromUrl\(r\.url\)/);
    expect(strip(saved)).not.toMatch(/sourceIcon: null/);
  });

  it("never labels a story with the word 'Saved' as if it were a publisher", () => {
    expect(strip(saved)).toMatch(/source: r\.source \|\| sourceFromUrl\(r\.url\)/);
    expect(strip(saved)).not.toMatch(/source: r\.source \?\? "Saved"/);
  });

  it("survives a malformed url", () => {
    expect(strip(saved)).toMatch(/function hostOf\(url: string\)[\s\S]{0,220}catch \{[\s\S]{0,60}return null;/);
  });
});

describe("the card shows what the story already carries", () => {
  it("renders a real <time>, not a bare span", () => {
    // `timeAgo` is the readable form; `dateTime` is the machine-readable one a
    // crawler and a screen reader need, and `title` is the absolute timestamp
    // that "3h ago" alone can never give.
    expect(N).toMatch(/<time[\s\S]{0,320}dateTime=\{item\.publishedAt \? new Date\(item\.publishedAt\)\.toISOString\(\) : undefined\}/);
    expect(N).toMatch(/title=\{item\.publishedAt \? new Date\(item\.publishedAt\)\.toUTCString\(\) : undefined\}/);
  });

  it("shows the other categories a story matched", () => {
    // `categories` has always been computed and shipped - it drives the "For
    // You" filter and push targeting - but only the primary one was rendered,
    // so a story matching four showed one.
    expect(N).toMatch(/item\.categories[\s\S]{0,160}\.filter\(\(c\) => c !== item\.category\)/);
    // Capped, or a busy story turns the card into a tag cloud.
    expect(N).toMatch(/\.slice\(0, 2\)/);
  });

  it("makes the source a filter", () => {
    // 29 feeds and no way to say "more from this one".
    expect(N).toMatch(/onClick=\{\(e\) => \{ e\.stopPropagation\(\); onSource\(item\.source\); \}\}/);
    expect(N).toMatch(/onSource: \(s: string\) => void/);
  });

  it("routes source and token through the same visible search", () => {
    // Both drive the search box rather than a hidden filter dimension, so what
    // the feed is narrowed by is on screen and can be cleared.
    expect(N).toMatch(/onToken=\{searchToken\}/);
    expect(N).toMatch(/onSource=\{searchToken\}/);
  });
});
