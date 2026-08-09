import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// The sitemap publishes URLs that must actually resolve. The protocol segment
// is the sharp edge: the page validates `type` against a fixed set, so a
// mismatch here would advertise 404s to Google at scale. Both files are read
// directly (never a re-export) so the two lists are compared as they really are.
const sitemap = readFileSync("src/app/sitemap.ts", "utf8");
const protocolPage = readFileSync("src/app/markets/protocol/[type]/[slug]/page.tsx", "utf8");

describe("sitemap protocol URLs must match what the page accepts", () => {
  it("uses exactly the types the page validates against", () => {
    const accepted = (protocolPage.match(/TYPES\s*=\s*new Set\(\[([^\]]*)\]\)/)?.[1] ?? "")
      .split(",")
      .map((s) => s.trim().replace(/["']/g, ""))
      .filter(Boolean)
      .sort();
    const published = [...sitemap.matchAll(/\["(derivatives|dexs|fees)",/g)].map((m) => m[1]).sort();

    expect(accepted).toEqual(["derivatives", "dexs", "fees"]);
    expect(published).toEqual(accepted);
  });
});

describe("sitemap coverage and bounds", () => {
  it("lists the public pages that were missing", () => {
    for (const p of ["/tools", "/terms", "/privacy"]) {
      expect(sitemap).toContain(`\${SITE_URL}${p}\``);
    }
  });

  it("caps the coin list well below the 250 the API returns", () => {
    const cap = Number(sitemap.match(/MAX_COINS\s*=\s*(\d+)/)?.[1]);
    expect(cap).toBeGreaterThan(0);
    expect(cap).toBeLessThanOrEqual(150);
  });

  it("encodes ids and slugs, so an odd upstream value can't break the XML", () => {
    expect(sitemap).toMatch(/markets\/\$\{encodeURIComponent\(id\)\}/);
    expect(sitemap).toMatch(/\$\{encodeURIComponent\(slug\)\}/);
  });

  // A slow or down upstream must degrade to fewer URLs, never to a broken or
  // hanging sitemap.
  it("fetches best-effort, with a timeout and a null fallback", () => {
    expect(sitemap).toMatch(/AbortController/);
    expect(sitemap).toMatch(/setTimeout\(\(\) => ctrl\.abort\(\)/);
    expect(sitemap).toMatch(/catch\s*\{\s*return null;/);
  });

  // The bug this replaced: the sitemap fetched its OWN origin, and the failure
  // was silent, so production served a sitemap with no coin pages at all.
  it("never fetches its own origin", () => {
    expect(sitemap).not.toMatch(/fetch\(`\$\{SITE_URL\}/);
  });

  it("always emits coin URLs, even with every upstream down", () => {
    expect(sitemap).toMatch(/FALLBACK_COINS/);
    expect(sitemap).toMatch(/liveCoinIds\.length \? liveCoinIds : FALLBACK_COINS/);
    // Verified by running the built sitemap with the upstream blocked: 31 URLs
    // including 20 coins, where the old version produced 11 and no coins.
    const fallback = sitemap.match(/FALLBACK_COINS = \[([\s\S]*?)\]/)?.[1] ?? "";
    expect(fallback).toContain("bitcoin");
    expect(fallback).toContain("ethereum");
    expect(fallback.split(",").filter((s) => s.trim()).length).toBeGreaterThanOrEqual(15);
  });

  // A guessed protocol slug is a guaranteed 404 published to Google, which is
  // worse than omitting the section - so that half deliberately has no fallback.
  it("has no fallback for protocol slugs", () => {
    expect(sitemap).not.toMatch(/FALLBACK_PROTOCOL/);
  });
});
