import { describe, expect, it } from "vitest";
import { moodOf } from "@modules/news/components/NewsExtras";

describe("moodOf", () => {
  it("counts sentiment and leans by the bull/bear balance", () => {
    const m = moodOf([{ sentiment: "bullish" }, { sentiment: "bullish" }, { sentiment: "bearish" }, { sentiment: "neutral" }]);
    expect(m).toMatchObject({ bull: 2, bear: 1, neutral: 1, total: 4, lean: 25, label: "Leaning bullish" });
  });

  it("calls a close split balanced and says so when empty", () => {
    expect(moodOf([{ sentiment: "bullish" }, { sentiment: "bearish" }]).label).toBe("Balanced");
    expect(moodOf([])).toMatchObject({ total: 0, lean: 0, label: "No stories yet" });
  });

  it("leans bearish at -15 or below", () => {
    const m = moodOf([{ sentiment: "bearish" }, { sentiment: "bearish" }, { sentiment: "neutral" }, { sentiment: "bullish" }]);
    expect(m.lean).toBe(-25);
    expect(m.label).toBe("Leaning bearish");
  });
});
