import { describe, expect, it } from "vitest";
import { cacheKey, isCacheable, getCached, setCached } from "@/lib/ai/cache";

describe("cacheKey", () => {
  it("is deterministic and normalizes whitespace + case", () => {
    expect(cacheKey("summary", "Hello  World")).toBe(cacheKey("summary", "hello world"));
  });
  it("is scoped by task", () => {
    expect(cacheKey("summary", "a")).not.toBe(cacheKey("digest", "a"));
  });
});

describe("isCacheable", () => {
  it("excludes the streamed assistant, includes one-shot tasks", () => {
    expect(isCacheable("assistant")).toBe(false);
    for (const t of ["summary", "moderation", "why", "digest"] as const) expect(isCacheable(t)).toBe(true);
  });
});

describe("exact-match cache round-trip (in-process, no Redis)", () => {
  it("misses then hits after set", async () => {
    const key = cacheKey("why", "a one-off story headline for the cache test");
    expect(await getCached(key)).toBeNull();
    await setCached(key, "cached answer");
    expect(await getCached(key)).toBe("cached answer");
  });
});
