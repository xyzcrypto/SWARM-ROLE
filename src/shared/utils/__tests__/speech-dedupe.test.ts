import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Dictation delivered the same words twice (desktop Chrome re-sends already
// final results), and - after an index cursor fixed that - doubled or DROPPED
// words on Android Chrome, which repeats the phrase so far and restarts its
// result list. The hook now decides what is new by TEXT; the behaviour itself
// is replayed against scripted engine sessions in speech-merge.test.ts. This
// file pins that the hook actually uses that merge.
const src = readFileSync("src/shared/hooks/useSpeechInput.ts", "utf8");

describe("dictation delivers each word exactly once", () => {
  it("tracks delivered TEXT, not a result index", () => {
    expect(src).toMatch(/const deliveredRef = useRef\(""\)/);
    expect(src).not.toMatch(/deliveredRef\.current = i \+ 1/);
  });

  it("reads the whole result list and lets the merge decide what is new", () => {
    expect(src).toMatch(/for \(let i = 0; i < results\.length; i\+\+\)/);
    expect(src).toMatch(/newWords\(deliveredRef\.current, collapseFinals\(finals\)\)/);
    expect(src).not.toMatch(/for \(let i = e\.resultIndex/);
  });

  it("resets on start and on teardown, so a new session starts clean", () => {
    const resets = src.match(/deliveredRef\.current = ""/g) ?? [];
    expect(resets.length).toBeGreaterThanOrEqual(2);
  });

  it("uses one utterance per session on Android, where continuous mode is unreliable", () => {
    expect(src).toMatch(/rec\.continuous = \(opts\?\.continuous \?\? false\) && !android/);
  });
});
