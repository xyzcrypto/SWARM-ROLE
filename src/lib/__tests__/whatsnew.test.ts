import { describe, it, expect } from "vitest";
import { isWhatsNewTag, WHATS_NEW_TAGS, WHATS_NEW } from "@/lib/whatsnew";

describe("whatsnew tags", () => {
  it("validates tags against the catalog", () => {
    for (const t of WHATS_NEW_TAGS) expect(isWhatsNewTag(t)).toBe(true);
    expect(isWhatsNewTag("Nope")).toBe(false);
    expect(isWhatsNewTag(123)).toBe(false);
  });

  it("ships seed entries that all use valid tags", () => {
    expect(WHATS_NEW.length).toBeGreaterThan(0);
    for (const e of WHATS_NEW) expect(isWhatsNewTag(e.tag)).toBe(true);
  });
});
