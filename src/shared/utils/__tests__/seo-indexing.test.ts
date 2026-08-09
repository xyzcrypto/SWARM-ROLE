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

describe("/news/read must NOT also carry a canonical", () => {
  // The audit listed "no canonical" as a gap. Once the page went `noindex` that
  // stopped being a gap and became the correct state: `noindex` and
  // `rel=canonical` send contradictory signals - one says do not index, the
  // other says index that other URL instead - and Google advises against
  // combining them. Ticking the audit item off mechanically would have made
  // this worse, so the absence is pinned deliberately.
  it("has no canonical, because it is noindex", () => {
    expect(newsRead).not.toMatch(/alternates:\s*\{[^}]*canonical/);
  });
});

describe("/community has exactly one h1 per branch", () => {
  const community = readFileSync("src/app/community/page.tsx", "utf8");
  it("the crawlable anonymous view has a visible h1", () => {
    // This is the branch Google sees, and it had no h1 at all.
    expect(community).toMatch(/<h1 className="font-display/);
  });
  it("the logged-in view has one too, screen-reader-only", () => {
    // A member in a full-height chat does not need the vertical space spent on
    // a title, but the page still needs one h1 for assistive tech.
    expect(community).toMatch(/<h1 className="sr-only">/);
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

describe("auth pages: noindex vs robots.txt, applied consistently", () => {
  const login = readFileSync("src/app/login/page.tsx", "utf8");
  const forgot = readFileSync("src/app/forgot-password/page.tsx", "utf8");
  const sitemap = readFileSync("src/app/sitemap.ts", "utf8");
  const disallow = robots.match(/disallow:\s*\[([^\]]*)\]/)?.[1] ?? "";

  it("login and forgot-password send noindex", () => {
    expect(login).toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(forgot).toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  // The whole point: a page you want OUT of the index must stay crawlable, or
  // Google never sees the directive and anything already indexed stays stuck.
  it("neither is ALSO blocked in robots.txt", () => {
    expect(disallow).not.toMatch(/\/login/);
    expect(disallow).not.toMatch(/forgot-password/);
  });

  // /signup is a real landing page - it should rank, and it is in the sitemap
  // on purpose. Blanket-noindexing every "auth" page would have cost that.
  it("signup stays indexable and listed", () => {
    const signup = readFileSync("src/app/signup/page.tsx", "utf8");
    expect(signup).not.toMatch(/index:\s*false/);
    expect(sitemap).toContain("/signup`");
    expect(disallow).not.toMatch(/signup/);
  });

  it("the auth-gated app surfaces stay blocked, since they have nothing to de-index", () => {
    for (const p of ["/dashboard", "/settings", "/messages", "/journal", "/api/"]) {
      expect(disallow).toContain(p);
    }
  });
});
