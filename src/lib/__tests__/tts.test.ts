import { describe, it, expect } from "vitest";
import { pickVoice, nextRate, TTS_RATES } from "@/lib/tts";

const V = (name: string, lang: string) => ({ name, lang });

describe("pickVoice", () => {
  it("returns null when no voice matches any preferred lang", () => {
    expect(pickVoice([V("Anna", "it-IT")], ["en-US", "en"])).toBeNull();
  });

  it("matches by exact lang, then by prefix", () => {
    const voices = [V("Fred", "en-GB"), V("Alex", "en-US")];
    expect(pickVoice(voices, ["en-US"])?.name).toBe("Alex");
    // no en-US in this set → prefix match on "en"
    expect(pickVoice([V("Fred", "en-GB")], ["en"])?.name).toBe("Fred");
  });

  it("prefers a high-quality named engine within the matching lang", () => {
    const voices = [V("Basic", "en-US"), V("Google US English", "en-US")];
    expect(pickVoice(voices, ["en-US"])?.name).toBe("Google US English");
  });

  it("honours language priority order (Hindi before English for Hinglish)", () => {
    const voices = [V("Alex", "en-US"), V("Lekha", "hi-IN")];
    expect(pickVoice(voices, ["hi-IN", "en-IN", "en"])?.name).toBe("Lekha");
  });

  it("falls back to the first match when no engine name is nicer", () => {
    const voices = [V("One", "en-US"), V("Two", "en-US")];
    expect(pickVoice(voices, ["en-US"])?.name).toBe("One");
  });
});

describe("nextRate", () => {
  it("cycles through the defined rates and wraps", () => {
    expect(nextRate(1)).toBe(1.25);
    expect(nextRate(1.25)).toBe(1.5);
    expect(nextRate(1.5)).toBe(0.75);
    expect(nextRate(0.75)).toBe(1);
  });
  it("restarts at the first rate for an unknown value", () => {
    expect(nextRate(3)).toBe(TTS_RATES[0]);
  });
});
