import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// #259 shipped voice input that could never work: next.config.mjs sent
// `Permissions-Policy: microphone=()`, which blocks the mic for EVERY origin
// including this site, so the browser refused dictation before any of our code
// ran. Nothing in the app could detect that - the config is the only place it
// is visible, so it is the only place it can be pinned.
//
// Reads the real config file, not a re-export: a shim would match nothing and
// this test would pass while verifying nothing.
const config = readFileSync("next.config.mjs", "utf8");

describe("Permissions-Policy", () => {
  it("allows this origin to use the microphone", () => {
    expect(config).toMatch(/microphone=\(self\)/);
    expect(config).not.toMatch(/microphone=\(\)/);
  });

  it("still blocks camera and geolocation, which nothing here needs", () => {
    expect(config).toMatch(/camera=\(\)/);
    expect(config).toMatch(/geolocation=\(\)/);
  });
});
