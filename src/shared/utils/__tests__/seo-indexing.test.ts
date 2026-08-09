import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// These rules only exist in config/route files, so the files themselves are the
// only place they can be pinned. Read the real paths, never a re-export.
const robots = readFileSync("src/app/robots.ts", "utf8");
const newsRead = readFileSync("src/app/news/read/page.tsx", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");

describe("/news/read must stay out of the index", () => {
  it("sends noindex", () => {
    expect(newsRead).toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  // The subtle one: a crawler has to be allowed to FETCH the page to see the
  // noindex header. Disallowing it in robots.txt hides the very directive that
  // keeps it out, and Google can still index a disallowed URL found linked
  // elsewhere. Both together is a self-defeating combination.
  it("is NOT also disallowed in robots.txt, or the noindex is never read", () => {
    const disallow = robots.match(/disallow:\s*\[([^\]]*)\]/)?.[1] ?? "";
    expect(disallow).not.toMatch(/news\/read/);
  });

  it("still disallows the genuinely private, auth-gated areas", () => {
    const disallow = robots.match(/disallow:\s*\[([^\]]*)\]/)?.[1] ?? "";
    for (const p of ["/dashboard", "/api/", "/settings", "/messages", "/journal"]) {
      expect(disallow).toContain(p);
    }
  });
});

describe("the default social card", () => {
  // A 640x640 square in a `summary_large_image` slot was centre-cropped on
  // every share of every page. The file-convention card is 1200x630, but an
  // explicit `images` in the root metadata would override it.
  it("root metadata does not pin its own OG or Twitter image", () => {
    const og = layout.match(/openGraph:\s*\{[\s\S]*?\n  \},/)?.[0] ?? "";
    const tw = layout.match(/twitter:\s*\{[\s\S]*?\n  \},/)?.[0] ?? "";
    expect(og).not.toMatch(/images:/);
    expect(tw).not.toMatch(/images:/);
  });

  it("the generated card is the ratio the card format promises", () => {
    const og = readFileSync("src/app/opengraph-image.tsx", "utf8");
    expect(og).toMatch(/size\s*=\s*\{\s*width:\s*1200,\s*height:\s*630\s*\}/);
  });

  it("keeps the square logo for favicons, which should stay square", () => {
    expect(layout).toMatch(/icons:\s*\{\s*icon:\s*"\/logo\.png"/);
  });
});
