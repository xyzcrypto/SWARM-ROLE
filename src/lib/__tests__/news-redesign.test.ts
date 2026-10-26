import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CATEGORIES } from "@/lib/news";
import { PRIMARY_TOPICS } from "@modules/news/components/NewsClient";

// The /news redesign (2026-10) added a hero, a discovery sidebar, research and
// XYZ AI sections. Its rule was "real data or nothing". These checks keep the
// page from drifting into widgets that look busy but say something untrue.
const client = readFileSync("src/modules/news/components/NewsClient.tsx", "utf8");
const layout = readFileSync("src/modules/news/components/NewsLayout.tsx", "utf8");
const page = readFileSync("src/app/news/page.tsx", "utf8");
const all = client + layout + page;
// Code only: the explanatory comments are allowed to name what is absent.
const code = all.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");

describe("news redesign: real data only", () => {
  it("every visible topic chip is a real category, so no chip filters to nothing", () => {
    for (const t of PRIMARY_TOPICS) expect(CATEGORIES).toContain(t);
  });

  it("has no market-price widget on the News page", () => {
    expect(code).not.toMatch(/Market ?Pulse|MarketTicker|\/api\/ticker/i);
  });

  it("has no events list, because /news has no events source", () => {
    expect(code).not.toMatch(/Upcoming events|EventsPanel/i);
  });

  it("invents no audience or community numbers", () => {
    expect(code).not.toMatch(/\b\d+(\.\d+)?K\+|\bmembers\b.*\d|\d+\+ (Web3 )?builders/i);
  });

  it("states the source count from NEWS_SOURCES rather than a hard-coded number", () => {
    expect(layout).toMatch(/\{NEWS_SOURCES\.length\}/);
  });

  it("counts trending topics from the loaded stories", () => {
    expect(layout).toMatch(/for \(const i of items\) \{[\s\S]{0,120}for \(const c of i\.categories\)/);
  });

  it("shows newsletter success only after a 2xx from /api/subscribe", () => {
    expect(layout).toMatch(/fetch\("\/api\/subscribe"/);
    expect(layout).toMatch(/if \(!res\.ok\) \{ setState\("error"\)[\s\S]{0,120}return; \}\s*setState\("done"\)/);
  });

  it("has no featured-research block (owner removed it in revision 3)", () => {
    expect(code).not.toMatch(/FeaturedResearch|\/api\/research/);
  });

  it("time window is part of inFeed, so the list, reader and sidebar agree", () => {
    expect(client).toMatch(/\(since === "any" \|\| !now \|\| now - i\.publishedAt <= \(since === "1h" \? 3600e3 : 864e5\)\)/);
  });

  it("records read stories outside any state updater, and restores state after mount", () => {
    expect(client).not.toMatch(/setReadIds\(\(prev\) =>/);
    expect(client).toMatch(/const t = setTimeout\(\(\) => \{\s*try \{\s*const r = JSON\.parse\(localStorage\.getItem\(READ_KEY\)/);
  });

  it("trending momentum and sentiment come from the loaded stories", () => {
    expect(layout).toMatch(/const fresh = now > 0 && now - i\.publishedAt <= SIX_H/);
    expect(layout).toMatch(/if \(i\.sentiment === "bullish"\) t\.bull \+= 1/);
  });

  it("keeps the page heading out of JS-gated reveal wrappers (audit SEO6)", () => {
    expect(page).not.toMatch(/PageHeader|<Reveal/);
    expect(layout).toMatch(/<h1 className="hero-rise /);
  });

  it("sorts only by things the data has: server ranking or newest first", () => {
    expect(client).toMatch(/if \(sort === "latest"\) return items\.filter\(inFeed\)\.sort\(\(a, b\) => b\.publishedAt - a\.publishedAt\)/);
    expect(code).not.toMatch(/Most read/i);
  });

  it("does not treat an empty server batch as already loaded", () => {
    expect(client).toMatch(/if \(initial\?\.items\?\.length && category === "All" && !query\) \{ setLoading\(false\); return; \}/);
  });

  it("never ships story cards at opacity 0 waiting for an observer", () => {
    const card = client.slice(client.indexOf("const NewsCard = memo("), client.indexOf("// On-site reader"));
    const cardCode = card.replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    expect(cardCode).not.toMatch(/whileInView|motion\.article/);
    expect(card).toMatch(/className="hero-rise surface/);
  });

  it("sidebar is not sticky (a sticky column taller than the screen hides its bottom)", () => {
    expect(client).not.toMatch(/<aside className="[^"]*xl:sticky/);
  });

  it("Trending and High impact switch in the sidebar and each opens a See-all sheet", () => {
    expect(client).toMatch(/<DiscoverSwitch value=\{side\} onChange=\{setSide\} \/>/);
    expect(client).toMatch(/sheet === "trending" && \(/);
    expect(client).toMatch(/sheet === "impact" && \(/);
  });

  it("a story with no image gets the branded banner, not an empty box", () => {
    expect(client).toMatch(/\{\(!item\.image \|\| heroFailed\) && <StoryBanner item=\{item\}/);
  });
});
