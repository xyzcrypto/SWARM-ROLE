import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

// Four things in one request path. Note which are MEASURED and which are
// reasoned - they are not the same strength of claim.
//
// 1. MEASURED - the "double word" in AI answers. An answer citing one article
//    rendered that article's title 2 times: once inline (Markdown renders
//    `[Title](/research/slug)` as an <a>) and once again in a chip row built by
//    `extractSources` from the same markdown. Removing the row took it to 1.
//    NOT a decoder or parser fault - the provider deltas and the incremental
//    TextDecoder are both correct.
//
// 2. HARDENING, not a reproduced bug - `send` guarded on `busy`, which is React
//    STATE and therefore still false when a second call arrives in the same
//    tick. Two streaming loops writing `next[next.length - 1] = {...}` into one
//    bubble would interleave. An attempt to reproduce it by dispatching two
//    Enter keydowns in one tick fired only ONE request, so React's batching
//    appears to close this path in practice. The ref guard stays because state
//    is not a valid re-entrancy guard whatever the current batching does - but
//    it is not the fix for (1), and nothing here should be read as claiming it.
//
// 3. Time to first token. The route awaited the research query and then, in
//    sequence, three self-origin HTTP round trips for live grounding - neither
//    needing the other's result. That is dead time in front of a stream that
//    was working correctly all along.
//
// 4. Dictation needed a second action to send.
//
// Real source paths on purpose: `src/components/*` and `src/lib/*` are
// re-export shims after #203, so reading one matches nothing and passes while
// verifying nothing.
const widget = readFileSync("src/modules/ai/components/XyzAiWidget.tsx", "utf8");
const route = readFileSync("src/app/api/ai/assistant/route.ts", "utf8");
const speech = readFileSync("src/shared/hooks/useSpeechInput.ts", "utf8");
const conc = readFileSync("src/lib/ai/concurrency.ts", "utf8");
const strip = (s: string) => s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ");
const W = strip(widget);
const R = strip(route);
const S = strip(speech);

describe("two sends can never write into one bubble", () => {
  it("guards on a ref, not on the busy state", () => {
    expect(W).toMatch(/if \(!q \|\| sendingRef\.current\) return;/);
    expect(W).toMatch(/sendingRef\.current = true;/);
    // The state guard is what let the second call through.
    expect(W).not.toMatch(/if \(!q \|\| busy\) return;/);
  });

  it("releases the guard in `finally`, so a thrown request cannot wedge the composer", () => {
    expect(W).toMatch(/finally \{[\s\S]{0,160}sendingRef\.current = false;/);
  });

  it("aborts any previous request instead of orphaning it", () => {
    // The old code reassigned `abortRef.current` without aborting the old one,
    // which detached it from both `finally` and `clearChat`.
    // Inside `send`, and before the new controller is created. The window is
    // generous because the composer reset and history build sit between them.
    const body = /async function send\([\s\S]*?\n  \}/.exec(W)?.[0] ?? "";
    expect(body).not.toBe("");
    const abortAt = body.indexOf("abortRef.current?.abort()");
    const createAt = body.indexOf("new AbortController()");
    expect(abortAt, "send() never aborts a previous request").toBeGreaterThan(-1);
    expect(abortAt).toBeLessThan(createAt);
  });

  it("still writes the bubble by replacement, not by appending", () => {
    // This half was always correct and must stay correct - `+=` here would be a
    // second, genuine way to double text.
    expect(W).toMatch(/next\[next\.length - 1\] = \{ role: "assistant", content: acc \}/);
    expect(W).toMatch(/acc \+= decoder\.decode\(value, \{ stream: true \}\)/);
  });
});

describe("nothing optional blocks the first token", () => {
  it("runs the corpus query and the live snapshot together", () => {
    expect(R).toMatch(/const \[rows, live\] = await Promise\.all\(\[/);
    // Two sequential awaits is the shape this replaced.
    expect(R).not.toMatch(/const live = await fetchLiveSnapshot\(origin\)\.catch[\s\S]{0,40}const system/);
  });

  it("bounds how long live grounding may delay the answer", () => {
    const ms = Number(/LIVE_TIMEOUT_MS = (\d+)/.exec(R)?.[1]);
    expect(ms).toBeGreaterThan(0);
    // Paid on every message, for context the answer is correct without.
    expect(ms).toBeLessThanOrEqual(1000);
    expect(R).toMatch(/setTimeout\(\(\) => ctrl\.abort\(\), LIVE_TIMEOUT_MS\)/);
  });

  it("does not promise a concurrency limit it does not enforce", () => {
    // The message said "one at a time" while MAX_CONCURRENT was 2, so it
    // described neither the code nor what the reader had done.
    const max = Number(/MAX_CONCURRENT = (\d+)/.exec(strip(conc))?.[1]);
    expect(max).toBeGreaterThan(0);
    if (max > 1) expect(R).not.toMatch(/One XYZ AI request at a time/);
  });
});

describe("the assistant does not print a citation twice", () => {
  it("has no second copy of the source links", () => {
    // MEASURED: an answer citing one article rendered its title 2 times - once
    // inline (Markdown renders `[Title](/research/slug)` as an <a>) and once in
    // a chip row built by `extractSources` from the same markdown. Same title,
    // same destination, no added information. After removing the row: 1.
    //
    // Labelling the row "Sources" was tried first and rejected: it explains the
    // repetition rather than removing it, and the reader still reads the same
    // title twice.
    expect(W).not.toContain("extractSources");
    expect(W).not.toMatch(/sources\.map\(/);
  });

  it("left no dead module behind", () => {
    // The util had no other consumer. Keeping a tested-but-unreachable helper
    // "in case numbered citations happen later" is exactly how the WebGL scene
    // survived for months (#305) - if that lands, `git show` has it.
    expect(existsSync("src/shared/utils/ai-sources.ts")).toBe(false);
  });
});

describe("dictation sends itself", () => {
  it("fires onEnd only for a session that finished normally", () => {
    // "The user gave up" and "the mic failed" must not look like "the user
    // finished speaking" - both would auto-send a half-sentence.
    expect(S).toMatch(/const cancel = useCallback\(\(\) => \{[\s\S]{0,200}discardedRef\.current = true;/);
    expect(S).toMatch(/rec\.onerror[\s\S]{0,300}discardedRef\.current = true;/);
    expect(S).toMatch(/rec\.onend = \(\) => \{[\s\S]{0,300}if \(!discarded\) endCb\.current\?\.\(\)/);
  });

  it("arms a fresh session before it starts", () => {
    expect(S).toMatch(/deliveredRef\.current = "";\s*\n\s*discardedRef\.current = false;/);
  });

  it("reads the transcript from a ref, not from state", () => {
    // `onEnd` fires from a recognizer callback that closed over an older
    // render. Reading `input` there returns the value from before the last
    // transcript landed - an empty string on a single-utterance dictation.
    expect(W).toMatch(/onEnd: \(\) => \{[\s\S]{0,140}inputRef\.current\.trim\(\)/);
    expect(W).toMatch(/onEnd: \(\) => \{[\s\S]{0,200}if \(q\) void send\(q\)/);
  });

  it("keeps the ref current on both paths", () => {
    // The updater covers dictation (same tick as onEnd); the effect covers
    // typing, clearing and suggestion chips.
    expect(W).toMatch(/setInput\(\(v\) => \{[\s\S]{0,220}inputRef\.current = next;/);
    expect(W).toMatch(/useEffect\(\(\) => \{\s*inputRef\.current = input;\s*\}, \[input\]\)/);
  });

  it("does not break the dictation de-dupe guard", () => {
    // The cumulative-results trap that doubled dictated words. Pinned here as
    // well as in speech-dedupe.test.ts because this PR edits the same handlers.
    // Now text-based (speech-merge.ts), which also covers Android's repeated
    // and restarted result lists that an index cursor doubled or dropped.
    expect(S).toMatch(/newWords\(deliveredRef\.current, collapseFinals\(finals\)\)/);
    expect(S).not.toMatch(/for \(let i = e\.resultIndex/);
  });
});
