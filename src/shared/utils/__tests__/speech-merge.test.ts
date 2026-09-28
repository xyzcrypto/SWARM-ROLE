import { describe, expect, it } from "vitest";
import { appendWords, collapseFinals, newWords } from "@shared/utils/speech-merge";

/**
 * Replays scripted SpeechRecognition sessions - the event shapes each engine
 * really produces - through the same merge the hook uses, and checks what the
 * composer would end up holding. `run` mirrors the hook's onresult exactly.
 */
type Ev = Array<{ t: string; final: boolean }>;
function run(events: Ev[]): string {
  let delivered = "";
  let out = "";
  for (const results of events) {
    const session = collapseFinals(results.filter((r) => r.final).map((r) => r.t));
    const fresh = newWords(delivered, session);
    if (fresh) {
      out = out ? `${out} ${fresh}` : fresh; // the composer appends with a space
      delivered = appendWords(delivered, fresh);
    }
  }
  return out;
}

describe("dictation: every word once, none dropped", () => {
  it("desktop Chrome: cumulative list of separate utterances", () => {
    expect(run([
      [{ t: "hello", final: false }],
      [{ t: "hello there", final: true }],
      [{ t: "hello there", final: true }, { t: " how are", final: false }],
      [{ t: "hello there", final: true }, { t: " how are you", final: true }],
    ])).toBe("hello there how are you");
  });

  it("desktop Chrome: re-sends an event covering an already-final result", () => {
    // The original doubling bug.
    const a = [{ t: "gm everyone", final: true }];
    expect(run([a, a, a])).toBe("gm everyone");
  });

  it("Android: repeats the phrase so far as a NEW final result", () => {
    // Positions said "new result, emit it" -> "hello hello world".
    expect(run([
      [{ t: "hello", final: true }],
      [{ t: "hello", final: true }, { t: "hello world", final: true }],
      [{ t: "hello", final: true }, { t: "hello world", final: true }, { t: "hello world kaise ho", final: true }],
    ])).toBe("hello world kaise ho");
  });

  it("Android: restarts the list, next phrase at index 0", () => {
    // Positions said "index 0 already delivered" -> the words were dropped.
    expect(run([
      [{ t: "bitcoin is", final: true }],
      [{ t: "pumping today", final: true }],
      [{ t: "pumping today bro", final: true }],
    ])).toBe("bitcoin is pumping today bro");
  });

  it("Android: a restarted phrase that overlaps the previous one", () => {
    expect(run([
      [{ t: "send me the", final: true }],
      [{ t: "the chart please", final: true }],
    ])).toBe("send me the chart please");
  });

  it("ignores case and punctuation differences between repeats", () => {
    expect(run([
      [{ t: "Hello", final: true }],
      [{ t: "hello, world", final: true }],
    ])).toBe("Hello world");
  });

  it("interim-only events deliver nothing", () => {
    expect(run([[{ t: "maybe", final: false }], [{ t: "maybe not", final: false }]])).toBe("");
  });

  it("a genuinely repeated word in speech survives", () => {
    expect(run([[{ t: "very very good", final: true }]])).toBe("very very good");
  });

  it("collapseFinals and newWords directly", () => {
    expect(collapseFinals(["a b", "a b c", "a b"])).toBe("a b c");
    expect(newWords("a b", "a b c")).toBe("c");
    expect(newWords("a b c", "a b")).toBe("");
    expect(newWords("", "x")).toBe("x");
  });
});
