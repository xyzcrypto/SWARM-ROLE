import { describe, it, expect } from "vitest";
import { SITE_URL, absoluteUrl } from "@/lib/seo";

describe("absoluteUrl", () => {
  it("prefixes a leading-slash path with the site url", () => {
    expect(absoluteUrl("/research")).toBe(`${SITE_URL}/research`);
  });
  it("adds a slash for paths without one", () => {
    expect(absoluteUrl("research")).toBe(`${SITE_URL}/research`);
  });
  it("has no trailing slash on SITE_URL", () => {
    expect(SITE_URL.endsWith("/")).toBe(false);
  });
});
