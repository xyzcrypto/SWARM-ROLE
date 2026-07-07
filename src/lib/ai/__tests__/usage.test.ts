import { describe, expect, it } from "vitest";
import { errorKindOf } from "@/lib/ai/usage";

describe("errorKindOf", () => {
  it("categorizes provider errors into stable buckets", () => {
    expect(errorKindOf(new Error("blocked by safety filter"))).toBe("safety");
    expect(errorKindOf(new Error("429 rate limit exceeded"))).toBe("rate_limit");
    expect(errorKindOf(new Error("invalid api key (401)"))).toBe("auth");
    expect(errorKindOf(new Error("request timed out"))).toBe("timeout");
    expect(errorKindOf(new Error("503 service unavailable"))).toBe("server");
    expect(errorKindOf(new Error("something we don't recognize"))).toBe("unknown");
  });
});
