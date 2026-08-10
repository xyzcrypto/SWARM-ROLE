import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// ⚠️ Read the REAL component, not the re-export shim at src/components/Avatar.tsx.
// A test that reads a one-line `export * from` file matches nothing and passes
// while verifying nothing - the exact trap CLAUDE.md warns about.
const src = readFileSync("src/modules/profile/components/Avatar.tsx", "utf8");

describe("Avatar must not render through the image optimizer", () => {
  // The bug, from two screenshots: EVERY avatar on the site was a broken image
  // - profile hero, DM header, chat header, bottom nav - while on those same
  // screens the profile banner (a CSS background-image) and chat photos (a plain
  // <img>), both from the same Supabase host, rendered fine. The Navbar's
  // /logo.png rendered too, which is next/image over a static file rather than a
  // fetched one. So the failure tracked the optimizer's upstream fetch, not any
  // single URL, and the fix is to keep avatars out of that path entirely.
  it("uses a plain <img>, not next/image", () => {
    expect(src).not.toMatch(/from ["']next\/image["']/);
    expect(src).toMatch(/<img/);
  });

  // `fill` needs a positioned parent and CSS-only sizing; a plain <img> should
  // carry real width/height so a list of avatars cannot shift layout as they load.
  it("reserves the box with real width/height attributes", () => {
    expect(src).toMatch(/width=\{s\.px\}/);
    expect(src).toMatch(/height=\{s\.px\}/);
  });

  // Falling back to initials when there is no image is the whole reason a
  // missing photo has never looked broken. That path must survive.
  it("still falls back to initials when there is no image", () => {
    expect(src).toMatch(/initialsFrom\(name, email\)/);
  });
});
