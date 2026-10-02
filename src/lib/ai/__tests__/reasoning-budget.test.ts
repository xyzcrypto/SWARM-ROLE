import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import type { AiProvider } from "@/lib/ai/providers/types";

// Hermetic gateway: no Prisma usage rows, no cache hits (same as gateway.test.ts).
const { recordSpy } = vi.hoisted(() => ({ recordSpy: vi.fn() }));
vi.mock("@/lib/ai/usage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/usage")>();
  return { ...actual, recordAiUsage: recordSpy };
});
vi.mock("@/lib/ai/cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/cache")>();
  return { ...actual, getCached: async () => null, setCached: async () => {} };
});

import { isGeminiThinkingModel, isGroqReasoningModel, outputCeiling, thinkingBudgetFor, REASONING_HEADROOM, GEMINI_THINKING_BUDGET } from "@/lib/ai/providers/reasoning";
import { generationConfig, geminiProvider, textOf } from "@/lib/ai/providers/gemini";
import { groqParams } from "@/lib/ai/providers/groq";
import { runComplete, runStream, AiCapacityError } from "@/lib/ai/gateway";

beforeEach(() => recordSpy.mockClear());

describe("thinking never comes out of the answer's budget", () => {
  it("recognises the models that think", () => {
    expect(isGeminiThinkingModel("gemini-3.6-flash")).toBe(true);
    expect(isGeminiThinkingModel("gemini-2.5-flash")).toBe(true);
    expect(isGeminiThinkingModel("gemini-flash-latest")).toBe(true);
    expect(isGeminiThinkingModel("gemini-2.0-flash")).toBe(false);
    expect(isGroqReasoningModel("openai/gpt-oss-120b")).toBe(true);
    expect(isGroqReasoningModel("llama-3.3-70b-versatile")).toBe(false);
  });
  it("adds headroom on top of the answer only for a thinking model", () => {
    expect(outputCeiling(160, true)).toBe(160 + REASONING_HEADROOM);
    expect(outputCeiling(160, false)).toBe(160);
  });
  it("caps Gemini's thinking, and gives a tiny verdict none at all", () => {
    expect(generationConfig("gemini-3.6-flash", 1800)).toEqual({ maxOutputTokens: 1800 + REASONING_HEADROOM, thinkingConfig: { thinkingBudget: GEMINI_THINKING_BUDGET } });
    expect(generationConfig("gemini-3.6-flash", 8)).toEqual({ maxOutputTokens: 8 + REASONING_HEADROOM, thinkingConfig: { thinkingBudget: 0 } });
    expect(thinkingBudgetFor(64)).toBe(0);
    expect(generationConfig("gemini-2.0-flash", 160)).toEqual({ maxOutputTokens: 160 });
  });
  it("asks gpt-oss for low reasoning effort with headroom, and never sends that to Llama", () => {
    expect(groqParams("openai/gpt-oss-120b", 160)).toEqual({ max_tokens: 160 + REASONING_HEADROOM, reasoning_effort: "low" });
    expect(groqParams("llama-3.3-70b-versatile", 160)).toEqual({ max_tokens: 160 });
  });
  it("never shows a thought part as the answer", () => {
    expect(textOf({ candidates: [{ content: { parts: [{ text: "thinking…", thought: true }, { text: "Answer." }] } }] })).toBe("Answer.");
  });
});

describe("Gemini recovers from a retired model id and a rejected thinking field", () => {
  const ok = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] }), { status: 200 });
  let calls: { url: string; body: { generationConfig: Record<string, unknown> } }[] = [];
  afterEach(() => { vi.unstubAllGlobals(); calls = []; });

  it("falls back to the next model on 404 and says which model served", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return url.includes("/gemini-retired-model:") ? new Response("models/gemini-retired-model is not found", { status: 404 }) : ok("Hello");
    }));
    const res = await geminiProvider.complete({ model: "gemini-retired-model", prompt: "hi", maxTokens: 100 });
    expect(res.text).toBe("Hello");
    expect(res.servedModel).toBe("gemini-flash-latest");
    expect(calls.map((c) => c.url.split("/models/")[1].split(":")[0])).toEqual(["gemini-retired-model", "gemini-flash-latest"]);
  });
  it("retries the same model without thinkingConfig when the API rejects that field", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)); calls.push({ url, body });
      return body.generationConfig.thinkingConfig ? new Response("Invalid JSON payload: unknown field thinking_config", { status: 400 }) : ok("Fine");
    }));
    const res = await geminiProvider.complete({ model: "gemini-3.6-flash", prompt: "hi", maxTokens: 300 });
    expect(res.text).toBe("Fine");
    expect(calls).toHaveLength(2);
    expect(calls[1].body.generationConfig).toEqual({ maxOutputTokens: 300 + REASONING_HEADROOM }); // headroom kept
  });
  it("does not walk other models for a non-404 error (a bad key is a bad key)", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { calls.push({ url, body: { generationConfig: {} } }); return new Response("API key not valid", { status: 403 }); }));
    await expect(geminiProvider.complete({ model: "gemini-3.6-flash", prompt: "hi", maxTokens: 50 })).rejects.toThrow(/gemini 403/);
    expect(calls).toHaveLength(1);
  });
});

function provider(id: string, complete: () => Promise<{ text: string }>, chunks?: string[]): AiProvider {
  return {
    id, enabled: true, models: { fast: `${id}-f`, quality: `${id}-q` }, complete,
    streamChat: async () => ({ stream: (async function* () { for (const c of chunks ?? [`${id}-ok`]) yield c; })(), getUsage: () => undefined }),
  };
}

describe("an empty answer is a failure, not a result", () => {
  it("fails over to the next provider when the first returns nothing", async () => {
    const res = await runComplete("why", { prompt: "p", maxTokens: 160 }, {}, [provider("a", async () => ({ text: "   " })), provider("b", async () => ({ text: "real answer" }))]);
    expect(res.text).toBe("real answer");
    expect(res.provider).toBe("b");
  });
  it("raises the graceful capacity error when every provider is empty", async () => {
    await expect(runComplete("why", { prompt: "p", maxTokens: 160 }, {}, [provider("a", async () => ({ text: "" }))])).rejects.toBeInstanceOf(AiCapacityError);
  });
  it("a stream that ends without text fails over before a byte reaches the reader", async () => {
    const h = await runStream("assistant", { system: "s", messages: [{ role: "user", content: "q" }], maxTokens: 500 }, {}, [
      provider("a", async () => ({ text: "x" }), ["", ""]),
      provider("b", async () => ({ text: "x" }), ["Hello", " world"]),
    ]);
    let out = ""; for await (const d of h.stream) out += d;
    expect(h.provider).toBe("b");
    expect(out).toBe("Hello world");
  });
  it("leading empty deltas (a model thinking first) do not trigger failover", async () => {
    const h = await runStream("assistant", { system: "s", messages: [{ role: "user", content: "q" }], maxTokens: 500 }, {}, [
      provider("a", async () => ({ text: "x" }), ["", "", "Answer", "."]),
      provider("b", async () => ({ text: "x" }), ["never used"]),
    ]);
    let out = ""; for await (const d of h.stream) out += d;
    expect(h.provider).toBe("a");
    expect(out).toBe("Answer.");
  });
});

describe("the assistant only quotes live numbers; the health check can see a thinking model", () => {
  it("drops the markets blocks when the feed is on its fallback figures", () => {
    const src = readFileSync("src/app/api/ai/assistant/route.ts", "utf8");
    expect(src).toMatch(/global: global\?\.live \? global : null/);
    expect(src).toMatch(/coins: coins\?\.live && Array\.isArray\(coins\?\.list\)/);
  });
  it("probes with a realistic budget and reports finishReason + servedModel", () => {
    const src = readFileSync("src/app/api/ai/health/route.ts", "utf8");
    expect(src).not.toMatch(/maxTokens: 10\b/);
    expect(src).toMatch(/finishReason: res\.finishReason/);
    expect(src).toMatch(/servedModel: res\.servedModel \?\? model/);
  });
});
