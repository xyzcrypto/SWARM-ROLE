import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AiProvider } from "@/lib/ai/providers/types";

// Mock the DB-writing usage recorder so gateway tests stay hermetic (no Prisma),
// and so we can assert what gets metered. errorKindOf is kept real.
const { recordSpy } = vi.hoisted(() => ({ recordSpy: vi.fn() }));
vi.mock("@/lib/ai/usage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/usage")>();
  return { ...actual, recordAiUsage: recordSpy };
});

import { classifyError, runComplete, runStream, AiCapacityError } from "@/lib/ai/gateway";

function mockProvider(
  id: string,
  opts: { complete?: () => Promise<{ text: string }>; stream?: () => Promise<{ stream: AsyncIterable<string>; getUsage: () => undefined }> } = {}
): AiProvider {
  return {
    id,
    enabled: true,
    models: { fast: `${id}-fast`, quality: `${id}-quality` },
    complete: opts.complete ?? (async () => ({ text: `${id}-ok` })),
    streamChat:
      opts.stream ??
      (async () => ({
        stream: (async function* () {
          yield `${id}-ok`;
        })(),
        getUsage: () => undefined,
      })),
  };
}

beforeEach(() => recordSpy.mockClear());

describe("classifyError", () => {
  it("marks safety/content blocks fatal", () => {
    expect(classifyError(new Error("response blocked by safety filter"))).toBe("fatal");
  });
  it("fails over on rate limits and bad keys", () => {
    expect(classifyError(new Error("429 rate limit exceeded"))).toBe("failover");
    expect(classifyError(new Error("invalid api key (401)"))).toBe("failover");
  });
  it("retries transient server/network errors", () => {
    expect(classifyError(new Error("503 service unavailable"))).toBe("retry");
    expect(classifyError(new Error("fetch failed: ECONNRESET"))).toBe("retry");
  });
  it("defaults unknown errors to failover", () => {
    expect(classifyError(new Error("some weird thing"))).toBe("failover");
  });
});

describe("runComplete", () => {
  it("falls back to the next provider on a rate limit and records status:fallback", async () => {
    const primary = mockProvider("p", { complete: async () => { throw new Error("429 quota exhausted"); } });
    const secondary = mockProvider("s");
    const res = await runComplete("summary", { prompt: "hi", maxTokens: 10 }, {}, [primary, secondary]);
    expect(res.text).toBe("s-ok");
    expect(res.provider).toBe("s");
    expect(res.model).toBe("s-fast");
    const recorded = recordSpy.mock.calls.map((c) => c[0]);
    expect(recorded.some((r) => r.status === "fallback" && r.provider === "s" && r.task === "summary")).toBe(true);
  });

  it("records status:ok when the primary succeeds", async () => {
    const res = await runComplete("why", { prompt: "hi", maxTokens: 10 }, { userId: "u1" }, [mockProvider("p")]);
    expect(res.provider).toBe("p");
    expect(recordSpy).toHaveBeenCalledWith(expect.objectContaining({ status: "ok", provider: "p", userId: "u1" }));
  });

  it("surfaces a fatal (safety) error without falling over", async () => {
    const primary = mockProvider("p", { complete: async () => { throw new Error("content blocked"); } });
    const secondary = mockProvider("s");
    await expect(runComplete("summary", { prompt: "hi", maxTokens: 10 }, {}, [primary, secondary])).rejects.toThrow(/blocked/);
  });

  it("throws AiCapacityError and records status:error when every provider fails", async () => {
    const p = mockProvider("p", { complete: async () => { throw new Error("429"); } });
    const s = mockProvider("s", { complete: async () => { throw new Error("401 bad key"); } });
    await expect(runComplete("summary", { prompt: "x", maxTokens: 1 }, {}, [p, s])).rejects.toBeInstanceOf(AiCapacityError);
    expect(recordSpy).toHaveBeenCalledWith(expect.objectContaining({ status: "error", provider: "none" }));
  });

  it("throws AiCapacityError(no_provider) with an empty chain", async () => {
    await expect(runComplete("summary", { prompt: "x", maxTokens: 1 }, {}, [])).rejects.toMatchObject({ reason: "no_provider" });
  });
});

describe("runStream", () => {
  it("falls back before the first byte and meters once consumed", async () => {
    const primary = mockProvider("p", { stream: async () => { throw new Error("429 too many requests"); } });
    const secondary = mockProvider("s");
    const handle = await runStream(
      "assistant",
      { system: "sys", messages: [{ role: "user", content: "hi" }], maxTokens: 10 },
      {},
      [primary, secondary]
    );
    let out = "";
    for await (const d of handle.stream) out += d;
    expect(out).toBe("s-ok");
    expect(handle.provider).toBe("s");
    expect(handle.model).toBe("s-quality");
    expect(recordSpy).toHaveBeenCalledWith(expect.objectContaining({ status: "fallback", provider: "s", task: "assistant" }));
  });
});
