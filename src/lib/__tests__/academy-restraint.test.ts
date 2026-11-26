import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

// The design system's bar is "restraint over glow". These pin the pass that
// took the Academy from template-looking to handmade.
describe("Academy design restraint", () => {
  const ui = read("src/modules/academy/components/ui.tsx");
  it("card labels are quiet; only section headings wear the gold rule eyebrow", () => {
    expect(ui).toMatch(/if \(section\) return <div className=\{cn\("acad-eyebrow mono/);
    expect(ui).toMatch(/\{eyebrow && <Eyebrow section>\{eyebrow\}<\/Eyebrow>\}/);
  });
  it("stats are not boxes inside boxes", () => {
    expect(ui).toMatch(/<div className="min-w-0 py-1">/);
  });
  it("page titles are solid text; the gold gradient is kept for the hero", () => {
    for (const f of ["LeaderboardPage", "MyCertificates", "Achievements", "LearnIndex"]) {
      expect(read(`src/modules/academy/components/${f}.tsx`), f).not.toMatch(/title=\{<span className="text-gold-gradient">/);
    }
  });
  it("no decorative blur orbs on the dashboard or library cards", () => {
    expect(read("src/modules/academy/components/Dashboard.tsx")).not.toMatch(/blur-3xl/);
    expect(read("src/modules/academy/components/Library.tsx")).not.toMatch(/blur-2xl/);
  });
  it("no emoji in Academy interface copy", () => {
    const re = /[\u{1F300}-\u{1FAFF}]/u;
    for (const f of ["GreetBubble", "QuizClient", "Dashboard", "DailyGoal", "Hero"]) {
      const code = read(`src/modules/academy/components/${f}.tsx`).split("\n").filter((l) => !/^\s*(\/\/|\*|\{\/\*)/.test(l)).join("\n");
      expect(re.test(code), f).toBe(false);
    }
  });
});
