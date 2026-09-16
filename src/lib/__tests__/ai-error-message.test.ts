import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiUsage: {
      create: async () => ({}),
    },
  },
}));

import { AiCapacityError, runComplete } from "@/lib/ai/gateway";
import { aiErrorMessage } from "@modules/ai/lib/ai";

// "XYZ AI is busy at the moment. Please try again in a little while."
//
// ⚠️ That sentence is what the assistant panel showed while the AI was, in fact,
// not busy at all — reported from a screenshot. The gateway throws
// `new AiCapacityError("all_failed", { cause: lastErr })`, so the provider's real
// error is right there on `.cause`, and `aiErrorMessage` short-circuited on the
// `instanceof` check without ever reading it.
//
// So an expired key, an exhausted free quota and a network outage all rendered
// the same sentence — the one that suggests waiting, when waiting was never
// going to help. The function's own docstring says its job is to make the cause
// "diagnosable from a screenshot"; on the most common failure path it did the
// opposite.

const BUSY = "XYZ AI is busy at the moment. Please try again in a little while.";
const LIMIT = "XYZ AI has hit its usage limit for now. Please try again in a little while.";
const MISCONFIGURED = "XYZ AI isn't configured correctly right now. Please check back soon.";
const NOT_CONFIGURED = "XYZ AI isn't configured right now. Please check back soon.";

const allFailed = (cause?: unknown) => new AiCapacityError("all_failed", { cause });

describe("aiErrorMessage reads the cause the gateway attaches", () => {
  it("reports an exhausted quota as a usage limit, not as busy", () => {
    expect(aiErrorMessage(allFailed(new Error("429 Too Many Requests: rate limit reached")))).toBe(LIMIT);
    expect(aiErrorMessage(allFailed(new Error("RESOURCE_EXHAUSTED: quota exceeded")))).toBe(LIMIT);
  });

  it("reports a bad or expired key as misconfigured, not as busy", () => {
    expect(aiErrorMessage(allFailed(new Error("401 Unauthorized: invalid api key")))).toBe(MISCONFIGURED);
    expect(aiErrorMessage(allFailed(new Error("API key expired. Please renew the API key.")))).toBe(MISCONFIGURED);
  });

  // Waiting is the right advice when the failure really is transient, so the
  // old message stays — as a fallback, not as the only answer.
  it("still says busy for a genuinely transient failure", () => {
    expect(aiErrorMessage(allFailed(new Error("503 Service Unavailable")))).toBe(BUSY);
    expect(aiErrorMessage(allFailed(new Error("fetch failed")))).toBe(BUSY);
  });

  it("still says busy when there is no cause to read", () => {
    expect(aiErrorMessage(allFailed())).toBe(BUSY);
    expect(aiErrorMessage(allFailed(null))).toBe(BUSY);
  });

  // A different condition with a different remedy: nothing is configured at all.
  it("keeps no_provider distinct from all_failed", () => {
    expect(aiErrorMessage(new AiCapacityError("no_provider"))).toBe(NOT_CONFIGURED);
  });

  it("classifies a plain error the same way it always did", () => {
    expect(aiErrorMessage(new Error("429 rate limit"))).toBe(LIMIT);
    expect(aiErrorMessage(new Error("blocked by safety filter"))).toBe(
      "XYZ AI couldn't answer that one. Try rephrasing your question."
    );
    expect(aiErrorMessage(new Error("something odd"))).toBe(
      "XYZ AI ran into an issue finishing that answer. Please try again."
    );
  });
});

describe("the all-providers-failed log", () => {
  // With Sentry dark, this console line is the ONLY place the provider's real
  // message is written down. If it stops happening, an AI outage becomes
  // un-diagnosable again.
  it("logs the real error when every provider fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const provider = {
      id: "fake",
      models: { fast: "m", deep: "m" },
      complete: async () => {
        throw new Error("429 Too Many Requests: rate limit reached");
      },
    } as never;

    await expect(
      runComplete("summary", { prompt: "hi", maxTokens: 10 }, {}, [provider])
    ).rejects.toBeInstanceOf(AiCapacityError);

    const line = spy.mock.calls.flat().join(" ");
    expect(line).toContain("all providers failed");
    expect(line).toContain("rate limit reached");
    expect(line).toContain("kind=rate_limit");
    spy.mockRestore();
  });

  // ⚠️ Gemini's REST API takes the key as `?key=…`, so a URL/fetch error can
  // carry a LIVE API KEY in its message. Logging it verbatim would publish a
  // secret to the Vercel log drain.
  it("never writes an API key into the log", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const SECRET = "AIzaSyD1234567890abcdefghijklmno";
    const provider = {
      id: "fake",
      models: { fast: "m", deep: "m" },
      complete: async () => {
        throw new Error(`fetch failed: https://api.example.com/v1?key=${SECRET}&alt=sse`);
      },
    } as never;

    await expect(runComplete("summary", { prompt: "hi", maxTokens: 10 }, {}, [provider])).rejects.toThrow();

    const line = spy.mock.calls.flat().join(" ");
    expect(line).not.toContain(SECRET);
    expect(line).toContain("key=***");
    spy.mockRestore();
  });
});

describe("errorKindOf buckets the 4xx that used to fall through", () => {
  // ⚠️ Every other branch covers 401, 403, 429 or 5xx, so a 400/404 - a bad
  // request, or a model the provider stopped serving - was filed as "unknown".
  // A real outage showed ten `unknown` rows, which is the one label that cannot
  // be acted on. This does not claim those ten WERE 4xx; it removes the blind
  // spot so the next ones are legible.
  it("labels a bad request and a retired model", async () => {
    const { errorKindOf } = await import("@/lib/ai/usage");
    for (const m of [
      "400 Bad Request",
      "404 model not found",
      "The model `llama-3.1-70b` has been decommissioned",
      "model does not exist",
    ]) {
      expect(errorKindOf(new Error(m)), m).toBe("bad_request");
    }
  });

  it("does not steal the buckets that already worked", async () => {
    const { errorKindOf } = await import("@/lib/ai/usage");
    expect(errorKindOf(new Error("429 rate limit"))).toBe("rate_limit");
    expect(errorKindOf(new Error("401 invalid api key"))).toBe("auth");
    expect(errorKindOf(new Error("503 unavailable"))).toBe("server");
    expect(errorKindOf(new Error("blocked by safety"))).toBe("safety");
    expect(errorKindOf(new Error("request aborted"))).toBe("timeout");
    expect(errorKindOf(new Error("something nobody predicted"))).toBe("unknown");
  });
});
