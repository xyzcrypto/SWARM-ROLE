import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isRadarWorthy, RADAR_CATEGORIES } from "@modules/points/lib/airdrop-radar";

const BAND = "src/modules/points/components/PointsHero.tsx";
const ROUTE = "src/app/api/ai/why-matters/route.ts";

const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");

const band = strip(readFileSync(BAND, "utf8"));
const route = strip(readFileSync(ROUTE, "utf8"));

/**
 * These exist because the band was reported as "stuck, and not perp DEX", and
 * the cause was three separate pieces of hard-coded content rather than a fetch
 * that failed. Nothing errored; the card simply showed invented data forever.
 */
describe("the band shows real data or says it has none", () => {
  it("has no hard-coded placeholder story", () => {
    // ⚠️ The card used to fall back to a fixed item titled "Crypto ETF flows:
    // Ether loses $141M as Solana gains $61M" - general crypto news, on a card
    // that promises perp DEX and airdrops - carrying `category: "Airdrops"` and
    // `venues: ["Hyperliquid"]` so it would pass for one. A placeholder that
    // lies about its own category is worse than an empty card.
    expect(band).not.toMatch(/Crypto ETF flows/i);
    expect(band, "no fabricated story object").not.toMatch(/id:\s*["']fallback/);
  });

  it("has no hard-coded timestamp", () => {
    // ⚠️ `fetchedAt ? … : "Sep 19, 9:20 AM"`. A card that had never fetched
    // anything still claimed to have checked at a specific time, and that time
    // never changed - which is most of why it read as stuck.
    expect(band).not.toMatch(/"[A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2} [AP]M"/);
  });

  it("does not inflate the tracked count when the feed is empty", () => {
    // `items.length || 1` printed "1 tracked" against an empty list.
    expect(band).not.toMatch(/items\.length \|\| 1/);
  });

  it("polls, so an open tab keeps up", () => {
    // Fetching on mount and on wake only means a tab left open - which is what
    // someone watching a live feed does - never updates while it stays focused.
    expect(band).toMatch(/^export const RADAR_POLL_MS = ([\d_]+);/m);
    expect(band).toMatch(/setInterval\(tick, RADAR_POLL_MS\)/);
    // A hidden tab must not poll.
    expect(band).toMatch(/document\.hidden/);
  });

  it("draws one carousel dot per story", () => {
    // A fixed five dots over two stories gave three controls that did nothing.
    expect(band).not.toMatch(/\[0, ?1, ?2, ?3, ?4\]/);
    expect(band).toMatch(/length: carouselLength/);
  });
});

describe("the radar carries only this page's subject", () => {
  const item = (title: string, categories: string[] = ["Market News"], summary = "") => ({
    title,
    summary,
    categories,
  });

  it("takes the three categories the page is about", () => {
    expect([...RADAR_CATEGORIES].sort()).toEqual(["Airdrops", "Perp DEX", "Token Launches"]);
    for (const c of RADAR_CATEGORIES) expect(isRadarWorthy(item("Something", [c]))).toBe(true);
  });

  it("leaves general crypto news out, including the story that used to be hard-coded", () => {
    // The old placeholder, fed through the real filter, is correctly rejected -
    // which is the point: it could only ever have appeared by being hard-coded.
    expect(
      isRadarWorthy(item("Crypto ETF flows: Ether loses $141M as Solana gains $61M", ["Market News"]))
    ).toBe(false);
    expect(isRadarWorthy(item("Bitcoin ETF sees record inflows", ["Market News"]))).toBe(false);
  });
});

describe("the briefing streams, which is what makes it fast and complete", () => {
  it("offers a streamed path", () => {
    // ⚠️ "Slow" and "incomplete" were never two problems. One-shot generation
    // forces a trade: a ceiling high enough to finish is a wait long enough to
    // feel broken, and a low one is an answer that stops mid-section. Four
    // rounds were spent moving along that curve. Streaming removes the trade.
    expect(route).toMatch(/stream: z\.boolean\(\)/);
    expect(route).toMatch(/streamBriefing\(/);
    expect(route).toMatch(/new ReadableStream<Uint8Array>/);
  });

  it("tells proxies not to buffer, or it is not a stream", () => {
    expect(route).toMatch(/"X-Accel-Buffering": "no"/);
    expect(route).toMatch(/"Cache-Control": "no-store"/);
  });

  it("says so when a stream dies mid-answer", () => {
    // Closing quietly is indistinguishable from a briefing that finished early,
    // which is the ambiguity that made the one-shot version so hard to diagnose.
    expect(route).toMatch(/aiErrorMessage\(err\)/);
  });

  it("keeps the JSON contract for callers that did not ask to stream", () => {
    // Opt-in: every existing caller keeps `meta`, including `truncated`.
    expect(route).toMatch(/\.optional\(\)\.default\(false\)/);
    expect(route).toMatch(/completeTextWithMeta\(/);
  });

  it("routes a briefing to the quality model even when streamed", () => {
    // A briefing answered by the fast model writes two sentences and stops.
    // That bug was fixed once; a new code path must not reintroduce it.
    const ai = strip(readFileSync("src/modules/ai/lib/ai.ts", "utf8"));
    expect(ai).toMatch(/runStream\(\s*"briefing"/);
    // The real file, not a shim - `src/lib/ai/routing.ts` IS the implementation
    // here (it was never moved under `core/`), which a guess would have got
    // wrong in the direction that reads an empty match as a pass.
    const routing = strip(readFileSync("src/lib/ai/routing.ts", "utf8"));
    expect(routing).toMatch(/task === "briefing"\) return "quality"/);
  });
});

describe("the radar reads the whole pool, not a page of it", () => {
  const route = strip(readFileSync("src/app/api/points/radar/route.ts", "utf8"));
  const fetchLib = strip(readFileSync("src/modules/news/lib/news-fetch.ts", "utf8"));

  it("does not go through getNewsPage, whose pageSize is clamped", () => {
    // ⚠️ THE "0 tracked" BUG. The route asked for `{ pageSize: 200 }`, and
    // `getNewsPage` clamps with `Math.min(30, ...)` - so it silently received
    // 30, RANKED by general news impact. Filtering the day's 30 biggest crypto
    // stories for perp DEX and airdrop news legitimately matches nothing on a
    // day led by ETF and macro headlines. No error; just an empty radar.
    expect(route).not.toMatch(/getNewsPage\(/);
    expect(route).toMatch(/getClassifiedPool\(\)/);
  });

  it("the clamp that caused it is still there, so this stays necessary", () => {
    // If the clamp is ever lifted, this test should be revisited rather than
    // silently continuing to assert a workaround for a problem that is gone.
    expect(fetchLib).toMatch(/Math\.min\(30, Math\.max\(6, opts\.pageSize \|\| 15\)\)/);
  });

  it("reports what it looked at, so an empty radar can say why", () => {
    // "Nothing matched out of 0" is an outage; "out of 340" is a quiet hour.
    expect(route).toMatch(/diag: \{ pool: pool\.items\.length, matched: items\.length \}/);
  });
});

describe("a deleted research post leaves every surface", () => {
  const files = [
    "src/app/research/page.tsx",
    "src/app/page.tsx",
    "src/app/sitemap.ts",
    "src/app/api/search/posts/route.ts",
    "src/modules/research/components/RelatedResearch.tsx",
    "src/modules/research/components/ResearchPreview.tsx",
    "src/app/api/ai/assistant/route.ts",
  ];

  it("guards the index, the homepage, search, the sitemap, related and the AI corpus", () => {
    // ⚠️ Every one of these read `Post` without the trash filter, so deleting a
    // post left it on the research index (with its premium lock still on), in
    // search, in the sitemap - an active instruction to keep indexing a page
    // that no longer exists - in Related, in the homepage preview, and in the
    // assistant's grounding corpus.
    //
    // `post-soft-delete.test.ts` existed to prevent exactly this and reported
    // green, because it scanned a FIXED 420-character window after each call:
    // in `research/page.tsx` a correctly-guarded `count` sat inside the
    // unguarded `findMany`'s window, so its `NOT_TRASHED` was read as the
    // findMany's own. That window now matches real parentheses.
    for (const f of files) {
      expect(readFileSync(f, "utf8"), `${f} must filter the trash`).toMatch(/NOT_TRASHED|LIVE_POST/);
    }
  });
});

describe("the desk lane reaches the card", () => {
  const hero = strip(readFileSync("src/modules/points/components/PointsHero.tsx", "utf8"));

  it("fetches the desk lane at all", () => {
    // ⚠️ THE "+ post karta hu lekin card pe show nahi karta" BUG. The composer
    // writes to `PointsUpdate` via `/api/points/updates`; this card only ever
    // fetched `/api/points/radar`, the PRESS lane. A post saved correctly,
    // broadcast correctly, and had nowhere on the page to appear - the
    // redesign had dropped `UpdatesFeed`, the only thing that rendered it.
    expect(hero).toMatch(/\/api\/points\/updates/);
    expect(hero).toMatch(/useRealtime\(/);
    expect(hero).toMatch(/CH_POINTS/);
  });

  it("merges both lanes and lets a pinned desk post lead", () => {
    expect(hero).toMatch(/lane: "desk"/);
    expect(hero).toMatch(/a\.pinned \? -1 : 1/);
  });

  it("offers edit and delete on a desk row", () => {
    // "post karne ke baad edit or delete kar saku" - and on the row, because
    // the moment you notice a typo is while looking at the post.
    expect(hero).toMatch(/setEditing\(/);
    expect(hero).toMatch(/method: "DELETE"/);
    expect(hero).toMatch(/edit=\{editing \?\? undefined\}/);
  });

  it("the edit form is the SAME composer, not a second one", () => {
    const feed = strip(readFileSync("src/modules/points/components/UpdatesFeed.tsx", "utf8"));
    expect(feed).toMatch(/edit\?: PointsUpdateDto/);
    expect(feed).toMatch(/method: edit \? "PATCH" : "POST"/);
  });

  it("an edit can change the cover image", () => {
    // ⚠️ PATCH's schema had no `image`, and zod STRIPS unknown keys rather
    // than refusing them - so removing a cover appeared to work and silently
    // did nothing.
    const route = strip(readFileSync("src/app/api/points/updates/[id]/route.ts", "utf8"));
    expect(route).toMatch(/image: z\.string\(\)/);
    expect(route).toMatch(/data\.image = safeUrl\(/);
  });
});

describe("the points-analyzed counter is a measurement, not a decoration", () => {
  const route = strip(readFileSync("src/app/api/points/stats/route.ts", "utf8"));
  const hero = strip(readFileSync("src/modules/points/components/PointsHero.tsx", "utf8"));

  it("is not seeded with a fabricated total", () => {
    // ⚠️ It started at 12_400_000 AND the GET wrote that seed into Redis, so an
    // invented number became the stored truth - displayed as "$12.4M+" beside
    // two genuine statistics.
    expect(route).not.toMatch(/12_400_000|12400000/);
    expect(route).toMatch(/let inMemoryPointsAnalyzed = 0;/);
  });

  it("does not seed the store on a read", () => {
    expect(route).not.toMatch(/redis\.set\(ANALYZED_KEY/);
  });

  it("uses a fresh key, because the old one already holds the seed", () => {
    expect(route).toMatch(/const ANALYZED_KEY = "points:analyzed:v2"/);
  });

  it("moves as the reader calculates", () => {
    const calc = strip(readFileSync("src/modules/points/components/PointsCalculatorCard.tsx", "utf8"));
    expect(calc).toMatch(/onAnalyzed\?\.\(total\)/);
    expect(hero).toMatch(/analyzedTotal \?\? stats\.pointsAnalyzed/);
  });

  it("does not label a count of points as currency", () => {
    // "$12.4M+ Points Analyzed" reads as a sum of money. Points are not money.
    expect(hero).not.toMatch(/\$\$\{\(num \/ 1e9\)/);
    expect(hero).toMatch(/return `\$\{\(num \/ 1e6\)\.toFixed\(1\)\}M\+`/);
  });
});
