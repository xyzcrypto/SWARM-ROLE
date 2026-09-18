import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// ⚠️ This test exists because a single constant silently broke a whole feature.
//
// The gateway used a FLAT 15s timeout for every completion. `/api/ai/why-matters`
// asks for **2000 tokens** in `briefing` mode (2100 for the Hinglish
// translation). No model emits two thousand tokens in fifteen seconds, so the
// news briefing timed out on every attempt - and because a timeout classifies as
// a transient "retry", it then burned MAX_RETRIES more attempts against the same
// provider with backoff, then the next provider, before raising AiCapacityError.
//
// The reader saw exactly the two things that were reported: the briefing never
// worked, and it took most of a minute not to work.
//
// Real module paths, never the `src/lib` re-export shims left by #203 - a shim
// is one `export * from` line, so a regex against one matches nothing and the
// test passes while checking nothing at all.
const GATEWAY = "src/lib/ai/gateway.ts";
const ROUTE = "src/app/api/ai/why-matters/route.ts";

const strip = (s: string) =>
  s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ");

const gateway = strip(readFileSync(GATEWAY, "utf8"));
const route = strip(readFileSync(ROUTE, "utf8"));

describe("a completion's time budget scales with what it was asked to write", () => {
  it("no longer applies one flat timeout to every request", () => {
    // The constant may stay as a FLOOR; what must not survive is it being the
    // only thing a long generation gets.
    expect(gateway).toMatch(/function completeTimeoutMs\(/);
    expect(gateway).toMatch(/completeTimeoutMs\(req\.maxTokens\)/);
    expect(gateway).not.toMatch(/withTimeout\(COMPLETE_TIMEOUT_MS,/);
  });

  it("gives the briefing's own token budget a workable window", () => {
    // Pull the two numbers that actually have to agree out of the two files
    // rather than restating them, so this cannot pass on a stale copy.
    const perToken = Number(gateway.match(/maxTokens \* (\d+)/)?.[1]);
    const floor = Number(gateway.match(/const COMPLETE_TIMEOUT_MS = ([\d_]+);/)?.[1]?.replace(/_/g, ""));
    const cap = Number(gateway.match(/const MAX_COMPLETE_TIMEOUT_MS = ([\d_]+);/)?.[1]?.replace(/_/g, ""));
    expect(perToken).toBeGreaterThan(0);

    // Every maxTokens the briefing route can ask for must fit inside the budget.
    const asked = [...route.matchAll(/maxTokens:[\s\S]{0,160}?(\d{3,5})/g)].map((m) => Number(m[1]));
    const biggest = Math.max(...route.match(/\b(\d{3,4})\b/g)!.map(Number).filter((n) => n >= 160 && n <= 4000));
    expect(asked.length + biggest).toBeGreaterThan(0);

    const budget = Math.min(cap, Math.max(floor, biggest * perToken));
    expect(
      budget,
      `a ${biggest}-token generation gets ${budget}ms; that is not enough for a long answer`
    ).toBeGreaterThanOrEqual(45_000);
  });

  it("stays below the platform's function duration, so OUR error wins", () => {
    // ⚠️ Vercel kills a function at `maxDuration`. A gateway budget larger than
    // that means the platform always wins the race - and the platform's win is
    // an opaque 504 with no message, while the gateway's is a clean 502 the UI
    // can explain. The briefing produced exactly that 504 because the route
    // never declared a duration at all and took the short default.
    const cap = Number(gateway.match(/const MAX_COMPLETE_TIMEOUT_MS = ([\d_]+);/)?.[1]?.replace(/_/g, ""));
    const declared = Number(route.match(/^export const maxDuration = (\d+);/m)?.[1]);
    expect(declared, `${ROUTE} must declare maxDuration`).toBeGreaterThan(0);
    expect(cap, "gateway budget must finish before the platform kills the function").toBeLessThan(
      declared * 1000
    );
  });

  it("keeps a floor so a tiny request is not given a tiny window", () => {
    const floor = Number(gateway.match(/const COMPLETE_TIMEOUT_MS = ([\d_]+);/)?.[1]?.replace(/_/g, ""));
    expect(floor).toBeGreaterThanOrEqual(10_000);
    expect(gateway).toMatch(/Math\.max\(COMPLETE_TIMEOUT_MS/);
  });

  it("caps the budget so one request cannot hold a function open forever", () => {
    expect(gateway).toMatch(/const MAX_COMPLETE_TIMEOUT_MS = [\d_]+;/);
    expect(gateway).toMatch(/Math\.min\(MAX_COMPLETE_TIMEOUT_MS,/);
  });
});

describe("a timeout on a long generation is not retried against the same provider", () => {
  it("stops re-asking an identical long question that was merely still working", () => {
    // Retrying tripled the wait before the user saw an error, and paid for every
    // attempt. The request had not failed transiently; it was not finished.
    expect(gateway).toMatch(/const timedOut = /);
    expect(gateway).toMatch(/worthRetrying/);
    expect(gateway).toMatch(/req\.maxTokens > \d+/);
  });

  it("still retries a SHORT request that timed out, where a blip is plausible", () => {
    // The guard must be conditional on size, not a blanket "never retry a
    // timeout" - that would lose a genuine recovery on the cheap tasks.
    expect(gateway).toMatch(/kind === "retry" && !\(timedOut && req\.maxTokens > \d+\)/);
  });
});
