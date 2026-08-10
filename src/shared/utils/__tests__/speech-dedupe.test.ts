import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Dictation delivered the same words twice. With `continuous: true` the
// SpeechRecognition `results` list is CUMULATIVE - every event carries the
// whole session - and `resultIndex` is only a hint about where the change
// began. Chrome fires events whose `resultIndex` still covers an
// already-final result, so looping from `resultIndex` and emitting every final
// it saw delivered the same text again.
//
// There is no DOM (and no SpeechRecognition) in this project's vitest setup, so
// the guard is pinned structurally. Stated plainly: this proves the cursor
// exists and is used, not that a live utterance arrives once.
const src = readFileSync("src/shared/hooks/useSpeechInput.ts", "utf8");

describe("dictation must deliver each result exactly once", () => {
  it("keeps a delivered-so-far cursor", () => {
    expect(src).toMatch(/deliveredRef = useRef\(0\)/);
  });

  it("iterates from that cursor, never from resultIndex", () => {
    expect(src).toMatch(/for \(let i = deliveredRef\.current; i < results\.length; i\+\+\)/);
    // The old loop bound is what caused the duplication - it must be gone.
    expect(src).not.toMatch(/for \(let i = e\.resultIndex/);
  });

  it("advances the cursor the moment a result finalises", () => {
    expect(src).toMatch(/deliveredRef\.current = i \+ 1/);
  });

  it("resets the cursor on start and on teardown, so a new session cannot skip", () => {
    // Left un-reset, a second dictation would start past the whole first one
    // and deliver nothing at all - the opposite failure.
    const resets = src.match(/deliveredRef\.current = 0/g) ?? [];
    expect(resets.length).toBeGreaterThanOrEqual(2);
  });
});
