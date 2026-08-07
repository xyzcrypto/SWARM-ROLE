import { describe, expect, it } from "vitest";
import { speechErrorMessage } from "@/shared/hooks/useSpeechInput";

// The first version swallowed every failure, which is why voice read as
// "not working" with no clue why. Each code must produce something actionable.
describe("speech error messages", () => {
  // `not-allowed` covers two very different causes: the visitor declined the
  // browser prompt, or the site's own Permissions-Policy refused the mic first.
  // The second is what actually shipped in #259, so the wording must not blame
  // the visitor's browser settings.
  it("points at site permission without blaming the visitor's browser", () => {
    expect(speechErrorMessage("not-allowed")).toMatch(/allowed to use your mic/i);
    expect(speechErrorMessage("service-not-allowed")).toMatch(/allowed to use your mic/i);
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
