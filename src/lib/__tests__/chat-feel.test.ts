import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_FEEL, feelAttrs, parseFeel } from "@shared/utils/chat-feel";
import { soundAllowed } from "@shared/utils/sfx";
import { scalePattern } from "@shared/utils/haptics";

const read = (f: string) => readFileSync(f, "utf8");

describe("chat feel settings", () => {
  it("fall back to the defaults for missing or corrupted storage", () => {
    expect(parseFeel(null)).toEqual(DEFAULT_FEEL);
    expect(parseFeel("{not json")).toEqual(DEFAULT_FEEL);
    expect(parseFeel(JSON.stringify({ accent: "neon", text: "xxl", volume: 9, haptics: "max" }))).toEqual({ ...DEFAULT_FEEL, volume: 1 });
  });

  it("keep valid choices", () => {
    const f = parseFeel(JSON.stringify({ accent: "sky", text: "l", density: "compact", haptics: "strong", hapticsChosen: true, sound: "all", volume: 0.3 }));
    expect(f).toEqual({ accent: "sky", text: "l", density: "compact", haptics: "strong", hapticsChosen: true, sound: "all", volume: 0.3 });
  });

  it("honour the room's old sound toggle", () => {
    expect(parseFeel(null, "0").sound).toBe("off");
    expect(parseFeel(null, "1").sound).toBe("messages");
    // An explicit new setting wins over the legacy key.
    expect(parseFeel(JSON.stringify({ sound: "all" }), "0").sound).toBe("all");
  });

  it("the default changes nothing visible", () => {
    expect(DEFAULT_FEEL.accent).toBe("auto");
    expect(feelAttrs(DEFAULT_FEEL)).toEqual({ "data-accent": "auto", "data-text": "m", "data-density": "comfy" });
  });

  it("is read through useSyncExternalStore with a fixed server snapshot", () => {
    // Hydration-safe: the server and the hydrating client both see defaults.
    expect(read("src/shared/utils/chat-feel.ts")).toMatch(/useSyncExternalStore\(subscribe, getFeel, \(\) => DEFAULT_FEEL\)/);
  });
});

describe("sounds and haptics", () => {
  it("sound levels", () => {
    expect(soundAllowed("send", "off")).toBe(false);
    expect(soundAllowed("send", "messages")).toBe(true);
    expect(soundAllowed("tick", "messages")).toBe(false);
    expect(soundAllowed("tick", "all")).toBe(true);
  });

  it("strong haptics lengthen the buzz, not the pauses", () => {
    expect(scalePattern(8, 2)).toBe(16);
    expect(scalePattern([10, 40, 18], 2)).toEqual([20, 40, 36]);
  });

  it("an explicit choice overrides reduced-motion; no choice still respects it", () => {
    const h = read("src/shared/utils/haptics.ts");
    expect(h).toMatch(/if \(f\.hapticsChosen\) return true;/);
    expect(h).toMatch(/prefers-reduced-motion: reduce/);
  });

  it("every control in both chat surfaces gets feedback", () => {
    for (const f of ["src/modules/community/components/ChatClient.tsx", "src/modules/messages/components/MessagesClient.tsx"]) {
      expect(read(f), f).toMatch(/onPointerDownCapture=\{chatPressFeedback\}/);
      expect(read(f), f).toMatch(/\{\.\.\.feelAttrs\(feel\)\}/);
    }
  });

  it("sounds are synthesised - nothing to download, nothing for the CSP to block", () => {
    const s = read("src/shared/utils/sfx.ts");
    expect(s).toMatch(/createOscillator\(\)/);
    expect(s).not.toMatch(/new Audio\(|\.mp3|\.wav|fetch\(/);
  });

  it("the accent CSS keeps each surface's original colour by default", () => {
    const css = read("src/app/globals.css");
    expect(css).toMatch(/\[data-chat-surface="dm"\] \{ --acc: 209 143 27;/);
    expect(css).toMatch(/\[data-chat-surface="room"\] \{ --acc: 11 187 124;/);
  });
});
