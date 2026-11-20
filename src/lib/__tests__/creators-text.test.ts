import { describe, expect, it } from "vitest";
import { cleanText } from "@modules/creators/lib/text";

// The YouTube tab failed with "Invalid prisma.ytDiscovery.upsert(): unexpected
// end of hex escape" because a 1,500-character cut split an emoji in a video
// description. These pin the cleaner that every stored X/YouTube string uses.
describe("cleanText", () => {
  it("never cuts an emoji in half", () => {
    const s = "x".repeat(1499) + "🚀 rocket";
    const out = cleanText(s, 1500);
    expect(Array.from(out)).toHaveLength(1500);
    expect(out.endsWith("🚀")).toBe(true);
    expect(() => JSON.parse(JSON.stringify(out))).not.toThrow();
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(out)).toBe(false);
  });
  it("drops lone surrogates already in the input", () => {
    expect(cleanText("a\uD83Db")).toBe("ab");
    expect(cleanText("a\uDE80b")).toBe("ab");
    expect(cleanText("ok 🚀")).toBe("ok 🚀");
  });
  it("drops NUL, which Postgres refuses in text and jsonb", () => {
    expect(cleanText("a\u0000b")).toBe("ab");
  });
  it("handles missing values", () => {
    expect(cleanText(undefined)).toBe("");
    expect(cleanText(null, 5)).toBe("");
    expect(cleanText(42)).toBe("42");
  });
});
