import { describe, expect, it } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { parseCommand } from "@modules/academy/client/commands";
import { DEFAULT_AUDIO, parseSettings } from "@modules/academy/client/audio";
import { VOICE_LINES } from "@modules/academy/client/voice-lines";
import { SEED } from "@modules/academy/content";
import { categoryFile } from "@modules/academy/lib/content-schema";

describe("academy voice commands", () => {
  it.each([
    ["Start quiz", "start"],
    ["next question", "next"],
    ["repeat question", "repeat"],
    ["explain answer", "explain"],
    ["open leaderboard", "leaderboard"],
    ["mute", "mute"],
    ["unmute", "unmute"],
  ])("%s -> %s", (said, cmd) => {
    expect(parseCommand(said)?.cmd).toBe(cmd);
  });
  it("picks an option by letter or word", () => {
    expect(parseCommand("option B")).toEqual({ cmd: "answer", option: 1 });
    expect(parseCommand("answer four")).toEqual({ cmd: "answer", option: 3 });
  });
  it("ignores chatter", () => {
    expect(parseCommand("hello there")).toBeNull();
    expect(parseCommand("")).toBeNull();
  });
});

describe("academy audio settings", () => {
  it("falls back to defaults on junk, and never autoplays music by default", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_AUDIO);
    expect(parseSettings("{oops")).toEqual(DEFAULT_AUDIO);
    expect(DEFAULT_AUDIO.music).toBe(false);
  });
  it("clamps volumes and keeps valid choices", () => {
    const s = parseSettings(JSON.stringify({ masterVol: 7, voice: false, voiceName: "Samantha" }));
    expect(s.masterVol).toBe(1);
    expect(s.voice).toBe(false);
    expect(s.voiceName).toBe("Samantha");
  });
});

describe("academy content", () => {
  it("every scripted Nova line has its recorded clip", () => {
    const missing = Object.keys(VOICE_LINES).filter((k) => !existsSync(`public/academy/voice/${k}.mp3`));
    expect(missing).toEqual([]);
  });
  it("there is a spoken intro for every seeded topic", () => {
    const slugs = SEED.map((c) => categoryFile.parse(c).slug);
    expect(slugs.filter((s) => !(`learn_${s}` in VOICE_LINES))).toEqual([]);
  });
  it("the starter curriculum is valid: 14 topics, 4 levels each, 20 questions each", () => {
    expect(SEED).toHaveLength(14);
    for (const raw of SEED) {
      const c = categoryFile.parse(raw);
      expect(c.modules.map((m) => m.level)).toEqual(["beginner", "intermediate", "advanced", "expert"]);
      expect(c.questions).toHaveLength(20);
      const mods = new Set(c.modules.map((m) => m.slug));
      for (const q of c.questions) expect(mods.has(q.module)).toBe(true);
    }
  });
  it("the right answer is not given away by being the longest option", () => {
    let longest = 0;
    let total = 0;
    for (const raw of SEED) {
      for (const q of categoryFile.parse(raw).questions) {
        total++;
        const L = q.options.map((o) => o.length);
        if (L[q.answer] === Math.max(...L) && L.filter((x) => x === L[q.answer]).length === 1) longest++;
      }
    }
    expect(longest / total).toBeLessThan(0.35);
  });
  it("no em dashes in learner-facing copy", () => {
    const text = SEED.map((c) => JSON.stringify(c)).join("") + JSON.stringify(VOICE_LINES);
    expect(text).not.toMatch(/—/);
  });
  it("client components import channel names from the browser-safe module", () => {
    const hooks = readFileSync("src/modules/academy/client/hooks.ts", "utf8");
    expect(hooks).toMatch(/@\/lib\/realtime-channels/);
    expect(hooks).not.toMatch(/from "@\/lib\/realtime"/);
  });
  it("academy content never waits on a scroll observer to become visible", () => {
    // whileInView left whole sections at opacity 0 when a fast scroll or an
    // anchor jump skipped the observer (found in the alignment pass).
    const dir = "src/modules/academy/components";
    const offenders = readdirSync(dir, { recursive: true })
      .map(String)
      .filter((f) => f.endsWith(".tsx") && readFileSync(`${dir}/${f}`, "utf8").includes("whileInView"));
    expect(offenders).toEqual([]);
  });
  it("every curriculum text in the voice manifest has its recording", () => {
    const manifest = JSON.parse(readFileSync("src/modules/academy/content/voice-manifest.json", "utf8")) as string[];
    expect(manifest.length).toBeGreaterThan(1500);
    expect(manifest.filter((h) => !existsSync(`public/academy/voice/c/${h}.mp3`))).toEqual([]);
  });
});
