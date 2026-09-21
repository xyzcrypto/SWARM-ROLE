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
