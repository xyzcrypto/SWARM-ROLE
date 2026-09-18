import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// ⚠️ The AI briefing was "fixed" THREE times and stayed broken. Each fix was a
// real bug - a flat timeout, a missing `maxDuration`, the wrong model tier - and
// none of them was the whole story, because nothing on the path could answer the
// one question that mattered: **why did the answer stop?**
//
// A truncated answer and a genuinely brief one are identical in the text. Only
// the provider's stop reason separates them, and BOTH providers were discarding
// it. So every diagnosis was a guess.
//
// Worse, the response cache stored any non-empty text for TWENTY-FOUR HOURS. One
// half-finished briefing was then served to every identical request for a day -
// across deploys - so each fix appeared to do nothing.
//
// These tests pin the three things that make the next report a fact.
const strip = (s: string) =>
  s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ");

const types = strip(readFileSync("src/lib/ai/providers/types.ts", "utf8"));
const groq = strip(readFileSync("src/lib/ai/providers/groq.ts", "utf8"));
const gemini = strip(readFileSync("src/lib/ai/providers/gemini.ts", "utf8"));
const gateway = strip(readFileSync("src/lib/ai/gateway.ts", "utf8"));
const route = strip(readFileSync("src/app/api/ai/why-matters/route.ts", "utf8"));
const block = strip(readFileSync("src/modules/news/components/BriefingBlock.tsx", "utf8"));

describe("the reason a generation stopped survives the trip", () => {
  it("is part of the result type", () => {
    expect(types).toMatch(/finishReason\?: FinishReason/);
    expect(types).toMatch(/"stop" \| "length" \| "other"/);
  });

  it("Groq's finish_reason is carried, not dropped", () => {
    expect(groq).toMatch(/finish_reason/);
    expect(groq).toMatch(/finishReason/);
  });

  it("Gemini's finishReason is carried, and MAX_TOKENS is read as truncation", () => {
    // Gemini spells it differently. Reading only Groq's spelling would leave the
    // primary provider silent, which is the provider most answers come from.
    expect(gemini).toMatch(/MAX_TOKENS/);
    expect(gemini).toMatch(/finishReason/);
  });
});

describe("a truncated answer is never cached", () => {
  it("the cache write is conditional on the answer being complete", () => {
    // ⚠️ THE mechanism that made three fixes look ineffective. The cache holds a
    // response for 24h and stored anything non-empty, so one cut-off briefing
    // was served for a day after the code that produced it had been replaced.
    expect(gateway).toMatch(/res\.finishReason !== "length"/);
    expect(gateway).toMatch(/setCached\(key, res\.text\)/);
  });

  it("still caches a complete answer, or the cache is pointless", () => {
    // The guard must be about truncation, not a blanket "never cache".
    expect(gateway).not.toMatch(/if \(false\)/);
    expect(gateway).toMatch(/if \(key && res\.text && res\.finishReason !== "length"\)/);
  });
});

describe("a briefing that hits the ceiling is finished, not served half", () => {
  it("continues from where it stopped", () => {
    expect(route).toMatch(/meta\.finishReason === "length"/);
    expect(route).toMatch(/Continue this briefing from exactly where it stops/);
  });

  it("continues at most ONCE", () => {
    // Two would be a loop with a bill attached. If one more pass is not enough,
    // saying so is more honest than spending again.
    const continuations = [...route.matchAll(/Continue this briefing/g)].length;
    expect(continuations).toBe(1);
    expect(route).not.toMatch(/while \(|for \(let attempt/);
  });

  it("only does this for the LONG modes", () => {
    // A "why this matters" is two sentences by design; stopping at its ceiling
    // means something else is wrong and continuing would paper over it. The
    // roundup is long-form like the briefing, so it earns the same treatment.
    expect(route).toMatch(/\(mode === "briefing" \|\| mode === "roundup"\) && meta\.finishReason === "length"/);
    expect(route).not.toMatch(/mode === "why".*finishReason === "length"/);
  });

  it("still reports truncation when even the continuation ran out", () => {
    expect(route).toMatch(/truncated: meta\.finishReason === "length" && !continued/);
  });
});

describe("the reader can see what happened", () => {
  it("the answer travels with its metadata", () => {
    expect(route).toMatch(/meta: \{/);
    expect(route).toMatch(/continued,/);
  });

  it("says so when a briefing was cut short", () => {
    // A fragment presented as a finished briefing leaves a reader to conclude
    // the feature is broken - which is exactly what happened, three times.
    expect(block).toMatch(/meta\?\.truncated/);
    expect(block).toMatch(/ran out of room before it finished/);
  });

  it("names the model, and says when the answer came from cache", () => {
    expect(block).toMatch(/meta\.cached \? "cached" : meta\.model/);
  });
});

describe("a briefing is routed as the long task it is", () => {
  const routing = strip(readFileSync("src/lib/ai/routing.ts", "utf8"));
  const limits = strip(readFileSync("src/lib/ai/limits.ts", "utf8"));

  it("gets the quality model regardless of plan", () => {
    // It shared `digest` and so went to the FAST model as "bulk deterministic"
    // work. A digest is two or three sentences; a briefing is 650-900 words.
    expect(routing).toMatch(/if \(task === "briefing"\) return "quality"/);
  });

  it("counts against the daily cap", () => {
    // The longest generation a member can trigger, on the quality model, is the
    // single most costly thing to leave uncounted.
    expect(limits).toMatch(/"briefing"/);
  });
});
