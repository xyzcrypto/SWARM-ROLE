import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { badgesFor, CATEGORIES, quality } from "@modules/feedback/lib/shared";
import { greetName, nameClip, NAME_BANK } from "@modules/academy/client/name-bank";
import { greeting, greetPage, hey } from "@modules/academy/client/greet";
import { VOICE_LINES } from "@modules/academy/client/voice-lines";
import { activeLaunches, LAUNCHES } from "@shared/utils/launches";

const ROOT = join(__dirname, "../../..");

describe("feedback quality meter", () => {
  it("is 0 for nothing and grows with useful detail", () => {
    expect(quality("")).toBe(0);
    const short = quality("bad page");
    const rich = quality("The markets page on my iPhone shows 0 for BTC after I refresh. It should show the price because the desktop page does.");
    expect(rich).toBeGreaterThan(short);
    expect(rich).toBeGreaterThanOrEqual(80);
  });
  it("penalises shouting", () => {
    expect(quality("THIS IS BROKEN FIX IT NOW PLEASE")).toBeLessThan(quality("this is broken, fix it now please"));
  });
  it("stays within 0..100", () => {
    expect(quality("word ".repeat(500))).toBeLessThanOrEqual(100);
  });
});

describe("feedback badges", () => {
  it("unlocks by count, category and shipped status", () => {
    expect(badgesFor([])).toEqual([]);
    expect(badgesFor([{ category: "idea", status: "new" }])).toEqual(["first"]);
    const bugs = Array.from({ length: 3 }, () => ({ category: "bug", status: "new" }));
    expect(badgesFor(bugs)).toContain("bug-hunter");
    expect(badgesFor([{ category: "bug", status: "done" }])).toContain("shipped");
    expect(badgesFor(Array.from({ length: 10 }, () => ({ category: "other", status: "new" })))).toContain("community-voice");
  });
  it("has a recorded AneQue line for every category", () => {
    for (const c of CATEGORIES) expect(`feedback_${c.id}` in VOICE_LINES).toBe(true);
  });
});

describe("AneQue greets by name", () => {
  it("picks the first real name", () => {
    expect(greetName("Md Raza")).toBe("Raza");
    expect(greetName("rahul sharma")).toBe("Rahul");
    expect(greetName("@crypto_king")).toBe("Crypto");
    expect(greetName("")).toBeNull();
    expect(greetName(null)).toBeNull();
    expect(greetName("Dr")).toBeNull();
  });
  it("uses her recorded clip for known names and the browser voice otherwise", () => {
    expect(nameClip("Rahul")).toBe("/academy/voice/n/rahul.mp3");
    expect(nameClip("Zorblax")).toBeNull();
    expect(hey("Zorblax")).toEqual({ url: null, text: "Hey Zorblax!" });
    expect(hey(null).text).toBe(VOICE_LINES.hey_there);
  });
  it("every name in the bank has its clip, and every scripted line its mp3", () => {
    for (const n of NAME_BANK) expect(existsSync(join(ROOT, `public/academy/voice/n/${n}.mp3`)), n).toBe(true);
    for (const k of Object.keys(VOICE_LINES)) expect(existsSync(join(ROOT, `public/academy/voice/${k}.mp3`)), k).toBe(true);
  });
  it("builds a full greeting on the first page and a short one after", () => {
    const base = { name: "Rahul", signedIn: true, hour: 9, streak: 3, learnedToday: false, dailyDone: false, r: 0.9 };
    const full = greeting({ ...base, page: "home", first: true });
    expect(full[0].text).toBe("Hey Rahul!");
    expect(full.map((p) => p.text)).toContain(VOICE_LINES.good_morning);
    expect(full.map((p) => p.text)).toContain(VOICE_LINES.greet_streak);
    expect(greeting({ ...base, page: "learn", first: false }).map((p) => p.text)).toEqual(["Hey Rahul!", VOICE_LINES.greet_learn]);
    expect(greeting({ ...base, page: "other", first: false })).toEqual([]);
    expect(greeting({ ...base, signedIn: false, name: null, page: "home", first: true }).map((p) => p.text)).toContain(VOICE_LINES.greet_guest);
  });
  it("maps paths to pages", () => {
    expect(greetPage("/academy")).toBe("home");
    expect(greetPage("/academy/learn/defi")).toBe("learn");
    expect(greetPage("/academy/live")).toBe("live");
    expect(greetPage("/academy/live/abc")).toBe("other");
    expect(greetPage("/academy/quiz")).toBe("other");
  });
  it("greets from the dock on every Academy page, not just the home page", () => {
    const dock = readFileSync(join(ROOT, "src/modules/academy/components/Guide.tsx"), "utf8");
    expect(dock).toMatch(/<GreetBubble /);
    const home = readFileSync(join(ROOT, "src/modules/academy/components/AcademyHome.tsx"), "utf8");
    expect(home).not.toMatch(/sessionStorage/);
  });
});

describe("launch popup", () => {
  it("shows a launch for its window, then retires it", () => {
    const l = LAUNCHES[0];
    const start = Date.parse(`${l.date}T00:00:00Z`);
    expect(activeLaunches(start + 1000)).toContainEqual(l);
    expect(activeLaunches(start - 1000)).not.toContainEqual(l);
    expect(activeLaunches(start + ((l.days ?? 21) + 1) * 86_400_000)).not.toContainEqual(l);
  });
  it("has unique ids", () => {
    expect(new Set(LAUNCHES.map((l) => l.id)).size).toBe(LAUNCHES.length);
  });
  it("auto-closes and can be closed", () => {
    const src = readFileSync(join(ROOT, "src/shared/components/LaunchPopup.tsx"), "utf8");
    expect(src).toMatch(/AUTO_MS = (\d+)/);
    const ms = Number(src.match(/AUTO_MS = (\d+)/)![1]);
    expect(ms).toBeGreaterThanOrEqual(5000);
    expect(ms).toBeLessThanOrEqual(10000);
    expect(src).toMatch(/aria-label="Close updates"/);
  });
});
