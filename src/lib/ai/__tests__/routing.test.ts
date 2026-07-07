import { describe, expect, it } from "vitest";
import { routeTier } from "@/lib/ai/routing";

describe("routeTier", () => {
  it("routes the assistant to the quality tier", () => {
    expect(routeTier("assistant")).toBe("quality");
  });
  it("routes bulk deterministic tasks to the fast tier", () => {
    for (const t of ["summary", "moderation", "why", "digest"] as const) {
      expect(routeTier(t)).toBe("fast");
    }
  });
});
