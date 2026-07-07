import { describe, expect, it } from "vitest";
import { routeTier } from "@/lib/ai/routing";

describe("routeTier", () => {
  it("routes bulk deterministic tasks to the fast tier regardless of plan", () => {
    for (const t of ["summary", "moderation", "why", "digest"] as const) {
      expect(routeTier(t, "Free")).toBe("fast");
      expect(routeTier(t, "Premium")).toBe("fast");
      expect(routeTier(t, "Admin")).toBe("fast");
    }
  });
  it("routes the assistant by plan: Free → fast, Premium/Admin → quality", () => {
    expect(routeTier("assistant", "Free")).toBe("fast");
    expect(routeTier("assistant", "Premium")).toBe("quality");
    expect(routeTier("assistant", "Admin")).toBe("quality");
  });
  it("defaults an unknown plan to Free (fast)", () => {
    expect(routeTier("assistant")).toBe("fast");
  });
});
