import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { cleanVoiceText } from "@modules/academy/lib/neural-voice";

const read = (p: string) => readFileSync(p, "utf8");
const hash = (t: string) => createHash("sha1").update(t.trim()).digest("hex").slice(0, 16);

describe("AneQue never falls back to the device's robotic voice", () => {
  const a = read("src/modules/academy/client/audio.ts");
  it("a failed recorded clip retries in the neural voice; a failed neural piece is skipped, not read by speechSynthesis", () => {
    expect(a).toMatch(/if \(!ownVoice\(\)\) return tts\(piece\.text, my, \(\) => pump\(my\)\);/);
    expect(a).toMatch(/if \(!piece\.neural && piece\.text\.trim\(\)\) queue\.unshift\(\.\.\.neuralPieces\(piece\.text\)\);/);
  });
  it("text with no recording becomes neural pieces up front (rendered while the previous one plays)", () => {
    expect(a).toMatch(/if \(ownVoice\(\)\) pieces = pieces\.flatMap\(\(p\) => \(p\.url \|\| !p\.text\.trim\(\) \? \[p\] : neuralPieces\(p\.text\)\)\);/);
    expect(a).toMatch(/\/api\/academy\/voice\/say\?l=\$\{l\}&t=\$\{encodeURIComponent/);
  });
  it("the device voice is used only when the learner picked one", () => {
    expect(a).toMatch(/const ownVoice = \(\) => snap\.settings\.voiceName === "nova";/);
  });
});

describe("the neural voice route", () => {
  const r = read("src/app/api/academy/voice/say/route.ts");
  it("is edge-cached per text for a year, rate-limited per IP, and never cached when it fails", () => {
    expect(r).toMatch(/public, max-age=86400, s-maxage=31536000, immutable/);
    expect(r).toMatch(/rateLimit\("academyVoice", ip\)/);
    expect(r).toMatch(/rateLimit\("academyVoiceDaily", ip\)/);
    expect(r).toMatch(/status: 503, headers: NO_STORE/);
  });
  it("caps and normalises the text", () => {
    expect(cleanVoiceText("  hello\n\n  world  ")).toBe("hello world");
    expect(cleanVoiceText("x".repeat(900))).toHaveLength(420);
    expect(cleanVoiceText(null)).toBe("");
  });
});

describe("every curriculum text has a studio recording", () => {
  it("lesson summaries, sections, examples, prompts, options and explanations of every track", () => {
    const man = new Set<string>(JSON.parse(read("src/modules/academy/content/voice-manifest.json")));
    const missing: string[] = [];
    for (const f of readdirSync("src/modules/academy/content").filter((x) => x.endsWith(".json"))) {
      const d = JSON.parse(read(`src/modules/academy/content/${f}`));
      if (!d || !Array.isArray(d.modules)) continue;
      const texts: string[] = [];
      for (const m of d.modules) {
        texts.push(m.summary);
        for (const s of m.sections) texts.push(s.heading, s.body);
        if (m.example) texts.push(m.example.title, m.example.body);
      }
      for (const q of d.questions) texts.push(q.prompt, q.explanation, ...q.options);
      for (const t of texts.filter((x) => x && x.trim())) if (!man.has(hash(t))) missing.push(`${d.slug}: ${t.slice(0, 50)}`);
    }
    expect(missing).toEqual([]);
  });
  it("every manifest entry has its file", () => {
    const man: string[] = JSON.parse(read("src/modules/academy/content/voice-manifest.json"));
    const absent = man.filter((h) => !existsSync(`public/academy/voice/c/${h}.mp3`));
    expect(absent).toEqual([]);
  });
});

describe("Academy music", () => {
  const a = read("src/modules/academy/client/audio.ts");
  it("plays studio loops gapless, one decoded at a time, with the generative tracks as a fallback", () => {
    for (const t of ["focus", "arena", "live", "night"]) expect(existsSync(`public/academy/music/${t}.mp3`), t).toBe(true);
    expect(a).toMatch(/src\.loop = true;/);
    expect(a).toMatch(/if \(!buf\) return startGenerative\(c\);/);
    expect(a).toMatch(/if \(loopBuf\?\.track === track\) return loopBuf\.buf;/);
  });
  it("live quizzes get their own track and a hit on every question and reveal", () => {
    expect(read("src/modules/academy/components/Guide.tsx")).toMatch(/path\?\.startsWith\("\/academy\/live\/"\) \? "live"/);
    const l = read("src/modules/academy/components/LiveArena.tsx");
    expect(l).toMatch(/sfx\("impact"\);/);
    expect(l).toMatch(/sfx\("stinger"\);/);
  });
});

describe("tactile layer", () => {
  it("is installed once by the Academy layout and never touches React's DOM", () => {
    expect(read("src/app/academy/layout.tsx")).toMatch(/<AcademyFx \/>/);
    const fx = read("src/modules/academy/components/AcademyFx.tsx");
    expect(fx).toMatch(/document\.body\.appendChild\(rip\)/);
    expect(fx).toMatch(/return null;/);
    const css = read("src/app/academy/academy.css");
    expect(css).toMatch(/scale: 0\.97;/); // composes with existing translate, unlike transform
    expect(css).toMatch(/html\.motion-off \.acad-ripple/);
  });
});
