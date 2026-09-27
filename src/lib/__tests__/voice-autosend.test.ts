import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { speechErrorMessage } from "@/shared/hooks/useSpeechInput";

// Voice-to-message: dictating a DM used to end with hunting for the Send button.
//
// `useSpeechInput` has supported auto-submit all along - its own doc comment on
// `onEnd` says "Exists so a caller can auto-submit" - and the XYZ AI panel uses
// it, because that panel calls the hook DIRECTLY. Every other composer on the
// site goes through `MicButton`, which called the hook as
// `useSpeechInput(onText, { continuous })` and dropped `onEnd` on the floor. One
// omission, and no composer could auto-send.
//
// Real source paths on purpose: `src/components/*` and `src/lib/*` are
// re-export shims after #203.
const strip = (s: string) => s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ");
const read = (p: string) => strip(readFileSync(p, "utf8"));
const mic = read("src/shared/components/MicButton.tsx");
const dm = read("src/modules/messages/components/MessagesClient.tsx");

describe("MicButton forwards the end-of-dictation signal", () => {
  it("passes onEnd through to the hook", () => {
    expect(mic).toMatch(/useSpeechInput\(onText, \{ continuous, onEnd \}\)/);
    expect(mic).not.toMatch(/useSpeechInput\(onText, \{ continuous \}\)/);
  });

  it("keeps it optional", () => {
    // A search box must not run a half-heard query on its own, so auto-send has
    // to be something a caller opts into rather than the default.
    expect(mic).toMatch(/onEnd\?: \(\) => void;/);
  });
});

describe("the DM composer sends what you dictated", () => {
  it("sends on end", () => {
    expect(dm).toMatch(/onEnd=\{\(\) => \{\s*const text = draftRef\.current\.trim\(\);\s*if \(text && !sending\) void send\(text\);/);
  });

  it("reads the draft from a ref, not from state", () => {
    // `onEnd` can fire in the SAME task as the last `onresult`, before React has
    // committed - so reading `draft` there sends the composer's contents from
    // before the transcript landed, which on a single-utterance dictation is an
    // empty string. This is the same reasoning the AI panel documents.
    expect(dm).toMatch(/const draftRef = useRef\(""\)/);
    expect(dm).toMatch(/useEffect\(\(\) => \{ draftRef\.current = draft; \}, \[draft\]\)/);
  });

  it("writes the ref synchronously in the mic handler", () => {
    // The effect above covers typing and the emoji picker, but it runs after
    // commit - too late for a dictation that ends in the same task.
    expect(dm).toMatch(/draftRef\.current = next;\s*setDraft\(next\);/);
  });

  it("does not double-send while a send is already in flight", () => {
    expect(dm).toMatch(/if \(text && !sending\)/);
  });
});

describe("what must never auto-send", () => {
  // Nothing that searches. A misheard query running itself is a different bug
  // from the one being fixed.
  for (const [name, path] of [
    ["command palette", "src/shared/components/CommandPalette.tsx"],
    ["news search", "src/modules/news/components/NewsClient.tsx"],
    ["research search", "src/modules/research/components/ResearchGrid.tsx"],
  ] as const) {
    it(`${name} keeps dictate-then-review`, () => {
      const src = read(path);
      const block = /<MicButton[\s\S]*?\/>/.exec(src)?.[0] ?? "";
      expect(block).not.toBe("");
      expect(block).not.toMatch(/onEnd/);
    });
  }
});

describe("a failed or abandoned session is not a finished one", () => {
  // The hook's guarantee, and the reason auto-send is safe to turn on: `onEnd`
  // fires only on a normal end. `cancel()` and every error path set
  // `discardedRef` first, so neither can be mistaken for "the user finished
  // speaking" and post a message they never meant to send.
  const hook = read("src/shared/hooks/useSpeechInput.ts");

  it("suppresses onEnd when the session was discarded", () => {
    expect(hook).toMatch(/const discarded = discardedRef\.current;[\s\S]{0,120}if \(!discarded\) endCb\.current\?\.\(\)/);
  });

  it("marks an error as discarded", () => {
    expect(hook).toMatch(/rec\.onerror[\s\S]{0,320}discardedRef\.current = true;/);
  });

  it("marks a cancel as discarded before aborting", () => {
    // `abort()` fires `onend` synchronously in some engines, so the order here
    // is the whole guarantee.
    expect(hook).toMatch(/discardedRef\.current = true;\s*ref\.current\?\.abort\(\)/);
  });

  it("says something useful when the mic is unavailable", () => {
    expect(speechErrorMessage("not-allowed")).toMatch(/Microphone unavailable/);
    expect(speechErrorMessage("no-speech")).toMatch(/Didn't catch that/);
    // "aborted" is the user's own stop - not an error worth showing.
    expect(speechErrorMessage("aborted")).toBe("");
  });
});
