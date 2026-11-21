import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseSettings } from "@modules/academy/client/audio";
import { VOICE_LINES } from "@modules/academy/client/voice-lines";
import { VOICE_LINES_HI } from "@modules/academy/client/voice-lines-hi";
import hinglish from "@modules/academy/content/hinglish.json";
import hiManifest from "@modules/academy/content/voice-manifest-hi.json";

const read = (p: string) => readFileSync(p, "utf8");
const h = (t: string) => createHash("sha1").update(t.trim()).digest("hex").slice(0, 16);
const HI = hinglish as Record<string, string>;
const content = ["blockchain-fundamentals", "defi-lending", "perp-dex-masterclass", "airdrop-masterclass"].map((s) => JSON.parse(read(`src/modules/academy/content/${s}.json`)));

describe("Hinglish settings", () => {
  it("defaults to English and remembers Hinglish", () => {
    expect(parseSettings(null).lang).toBe("en");
    expect(parseSettings(JSON.stringify({ lang: "hi" })).lang).toBe("hi");
    expect(parseSettings(JSON.stringify({ lang: "fr" })).lang).toBe("en");
    expect(parseSettings(null).explainRight).toBe(true);
  });
});

describe("Hinglish content", () => {
  it("covers every lesson and quiz string of the curriculum, in Latin script", () => {
    let total = 0;
    for (const c of content) {
      for (const q of c.questions) {
        for (const t of [q.prompt, q.explanation, ...q.options]) {
          if (!t?.trim()) continue;
          total++;
          expect(HI[h(t)], t).toBeTruthy();
          expect(HI[h(t)]).not.toMatch(/[ऀ-ॿ]/);
        }
      }
      for (const m of c.modules) for (const s of m.sections) expect(HI[h(s.body)], s.heading).toBeTruthy();
    }
    expect(total).toBeGreaterThan(300);
  });

  it("every Hinglish string has AneQue's recording (same voice)", () => {
    const have = new Set(hiManifest as string[]);
    const missing = Object.keys(HI).filter((k) => !have.has(k));
    expect(missing.length, `${missing.length} without a recording`).toBe(0);
    for (const k of (hiManifest as string[]).slice(0, 25)) expect(existsSync(`public/academy/voice/h/${k}.mp3`), k).toBe(true);
  });

  it("every scripted AneQue line has a Hinglish version and recording", () => {
    for (const k of Object.keys(VOICE_LINES)) {
      expect((VOICE_LINES_HI as Record<string, string>)[k], k).toBeTruthy();
      expect(existsSync(`public/academy/voice/hi/${k}.mp3`), k).toBe(true);
    }
  });
});

describe("voice explanations", () => {
  it("lesson sections and examples are recorded in English too", () => {
    const man = new Set(JSON.parse(read("src/modules/academy/content/voice-manifest.json")) as string[]);
    for (const c of content) for (const m of c.modules) for (const s of m.sections) expect(man.has(h(s.body)), s.heading).toBe(true);
  });
  it("right answers are explained aloud, not only wrong ones", () => {
    const q = read("src/modules/academy/components/QuizClient.tsx");
    expect(q).toMatch(/r\.correct && settings\.explainRight && r\.explanation/);
    expect(q).toMatch(/aria-label="Hear the explanation"/);
  });
  it("the language switch is in the Academy nav and Live Talk follows it", () => {
    expect(read("src/modules/academy/components/AcademyNav.tsx")).toMatch(/aria-label="Academy language"/);
    expect(read("src/modules/academy/client/talk.ts")).toMatch(/language: getSnapshot\(\)\.settings\.lang === "hi" \? "hinglish" : "english"/);
    expect(read("src/modules/academy/lib/aneque.ts")).toMatch(/always reply in natural Hinglish/);
  });
});
