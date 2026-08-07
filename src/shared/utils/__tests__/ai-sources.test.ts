import { describe, expect, it } from "vitest";
import { extractSources } from "@shared/utils/ai-sources";

describe("extracting cited research from an answer", () => {
  it("pulls a citation in the shape the grounding prompt asks for", () => {
    const out = extractSources("See [Perp DEX Landscape](/research/perp-dex-2026) for the fee models.");
    expect(out).toEqual([
      { title: "Perp DEX Landscape", slug: "perp-dex-2026", href: "/research/perp-dex-2026" },
    ]);
  });

  it("keeps first-appearance order and de-duplicates by slug", () => {
    const out = extractSources(
      "[Airdrops](/research/airdrop-meta) then [Perps](/research/perp-dex) then [Airdrops again](/research/airdrop-meta)"
    );
    expect(out.map((s) => s.slug)).toEqual(["airdrop-meta", "perp-dex"]);
    expect(out[0].title).toBe("Airdrops"); // the first title wins, not the later one
  });

  it("returns nothing for an uncited answer, so no empty source row renders", () => {
    expect(extractSources("Bitcoin is consolidating above its 50-day average.")).toEqual([]);
    expect(extractSources("")).toEqual([]);
  });

  it("ignores links that are not research citations", () => {
    const out = extractSources("[News hub](/news) and [Google](https://google.com) and [Journal](/journal)");
    expect(out).toEqual([]);
  });

  // The model writes prose around the citation; the regex must not swallow it.
  it("handles several citations across a multi-line answer", () => {
    const md = [
      "Two things matter here.",
      "",
      "- Funding rates — see [Perp Funding 101](/research/perp-funding-101)",
      "- Venue risk — see [Perp DEX Landscape](/research/perp-dex-2026)",
    ].join("\n");
    expect(extractSources(md).map((s) => s.slug)).toEqual(["perp-funding-101", "perp-dex-2026"]);
  });

  it("does not match a citation whose title spans a line break", () => {
    expect(extractSources("[broken\ntitle](/research/x)")).toEqual([]);
  });
});
