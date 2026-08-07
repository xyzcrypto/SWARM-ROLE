import { describe, expect, it } from "vitest";
import { speechErrorMessage } from "@/shared/hooks/useSpeechInput";

// The first version swallowed every failure, which is why voice read as
// "not working" with no clue why. Each code must produce something actionable.
describe("speech error messages", () => {
  it("tells the member how to fix a blocked microphone", () => {
    expect(speechErrorMessage("not-allowed")).toMatch(/mic access/i);
    expect(speechErrorMessage("service-not-allowed")).toMatch(/mic access/i);
  });

  it("names the real cause for Chrome's network failure", () => {
    // Chrome's recognizer is a Google service, so this fires on restricted
    // networks even while the page itself loads fine - "try again" alone would
    // send someone hunting in the wrong place.
    expect(speechErrorMessage("network")).toMatch(/speech service/i);
  });

  it("covers a missing mic and an empty utterance", () => {
    expect(speechErrorMessage("audio-capture")).toMatch(/no microphone/i);
    expect(speechErrorMessage("no-speech")).toMatch(/didn't catch/i);
  });

  it("stays silent when the member cancelled deliberately", () => {
    expect(speechErrorMessage("aborted")).toBe("");
  });

  it("still says something useful for an unknown code", () => {
    expect(speechErrorMessage("something-new")).toMatch(/type instead/i);
    expect(speechErrorMessage("")).toMatch(/type instead/i);
  });
});
