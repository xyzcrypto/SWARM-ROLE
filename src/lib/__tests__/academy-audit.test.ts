import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

describe("Academy audit fixes (2026-11-26)", () => {
  it("the hero's 'live now' shows live quizzes, not learners active in the last 10 minutes", () => {
    const h = read("src/modules/academy/components/Hero.tsx");
    expect(h).toMatch(/<Stat live=\{!!pulse\?\.liveNow\} value=\{pulse\?\.liveNow \?\? null\} label="live now" href="\/academy\/live" \/>/);
    expect(h).not.toMatch(/value=\{pulse\?\.learningNow \?\? null\} label="live now"/);
  });

  it("live counts come from each quiz's schedule (like the Live page), not the stored status", () => {
    const r = read("src/app/api/academy/pulse/route.ts");
    expect(r).toMatch(/listLive\(\)/);
    expect(r).toMatch(/live\.filter\(\(l\) => l\.state === "live"\)/);
    expect(read("src/modules/academy/lib/board.ts")).not.toMatch(/academyLive\.findMany\(\{ where: \{ status: "live" \}/);
  });

  it("an ended live quiz with no scorers never claims 'We have our winners'", () => {
    const a = read("src/modules/academy/components/LiveArena.tsx");
    expect(a).toMatch(/\{podium\.length \? <span className="text-shine">We have our winners<\/span> : "This quiz has ended"\}/);
  });

  it("haptics wait for the first tap instead of tripping the browser's intervention warning", () => {
    expect(read("src/shared/utils/haptics.ts")).toMatch(/if \(ua && !ua\.hasBeenActive\) return false;/);
  });
});
