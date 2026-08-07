import { describe, expect, it } from "vitest";
import { chunkForSpeech } from "@/lib/tts";

// Chrome stops speaking after ~15s and some Android engines reject very long
// strings, both silently - which is why "Listen" appeared broken on so many
// devices. Speaking a queue of short utterances sidesteps the limit.
describe("chunking text for speech", () => {
  it("leaves short text as a single utterance", () => {
    expect(chunkForSpeech("Bitcoin is up today.")).toEqual(["Bitcoin is up today."]);
  });

  it("returns nothing for empty input", () => {
    expect(chunkForSpeech("")).toEqual([]);
    expect(chunkForSpeech("   \n  ")).toEqual([]);
  });

  it("splits on sentence boundaries and keeps the terminator", () => {
    const text = "First sentence here. Second one follows! And a third? Yes.";
    const out = chunkForSpeech(text, 30);
    expect(out.length).toBeGreaterThan(1);
    expect(out.join(" ")).toBe(text);
    for (const c of out) expect(c.length).toBeLessThanOrEqual(30);
  });

  it("never exceeds the limit, even for one very long sentence", () => {
    const long = "word ".repeat(200).trim() + ".";
    for (const c of chunkForSpeech(long, 100)) expect(c.length).toBeLessThanOrEqual(100);
  });

  it("does not chop a word in half", () => {
    const out = chunkForSpeech("supercalifragilistic ".repeat(20).trim(), 60);
    for (const c of out) {
      expect(c.startsWith("supercalifragilistic") || c === "").toBe(true);
      expect(c.endsWith("supercalifragilistic")).toBe(true);
    }
  });

  it("preserves every word across the split", () => {
    const text = "Alpha beta gamma. Delta epsilon zeta eta. Theta iota kappa lambda mu.";
    expect(chunkForSpeech(text, 25).join(" ").split(/\s+/)).toEqual(text.split(/\s+/));
  });
});
