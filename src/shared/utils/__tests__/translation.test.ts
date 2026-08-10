import { describe, expect, it } from "vitest";
import { cleanTranslation, translationOrNull } from "@shared/utils/translation";

describe("cleaning what the model returns", () => {
  it("leaves a clean answer alone", () => {
    expect(cleanTranslation("Agla airdrop kab hai?")).toBe("Agla airdrop kab hai?");
  });

  it("strips a label the prompt told it not to add", () => {
    expect(cleanTranslation("Output: Agla airdrop kab hai?")).toBe("Agla airdrop kab hai?");
    expect(cleanTranslation("Hinglish: bhai kya scene hai")).toBe("bhai kya scene hai");
  });

  it("strips wrapping quotes, straight and curly", () => {
    expect(cleanTranslation('"bhai kya scene hai"')).toBe("bhai kya scene hai");
    expect(cleanTranslation("“bhai kya scene hai”")).toBe("bhai kya scene hai");
  });

  // A message that merely contains a quote is not wrapped in one.
  it("does not eat quotes that are part of the message", () => {
    expect(cleanTranslation('He said "gm" to everyone')).toBe('He said "gm" to everyone');
  });

  it("strips a trailing language note", () => {
    expect(cleanTranslation("Agla airdrop kab hai? (Hinglish)")).toBe("Agla airdrop kab hai?");
  });
});

describe("an echo is not a translation", () => {
  it("returns null when the model gives back the input", () => {
    expect(translationOrNull("gm everyone", "gm everyone")).toBeNull();
  });

  // Case, punctuation and spacing changes are not a translation either -
  // showing "Gm everyone!" for "gm everyone" would look like the button did
  // nothing, which is the complaint this exists to prevent.
  it("treats a cosmetic-only difference as an echo", () => {
    expect(translationOrNull("Gm everyone!", "gm everyone")).toBeNull();
    expect(translationOrNull("  gm   everyone  ", "gm everyone")).toBeNull();
  });

  it("passes a real translation through, in both directions", () => {
    expect(translationOrNull("Agla airdrop kab hai?", "When is the next airdrop?")).toBe(
      "Agla airdrop kab hai?"
    );
    expect(translationOrNull("The market is pumping", "Bhai market pump ho raha hai")).toBe(
      "The market is pumping"
    );
  });

  it("returns null for empty or missing output rather than an empty bubble", () => {
    expect(translationOrNull("", "hi")).toBeNull();
    expect(translationOrNull(null, "hi")).toBeNull();
    expect(translationOrNull("   ", "hi")).toBeNull();
  });
});
