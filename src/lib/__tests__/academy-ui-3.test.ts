import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

describe("live quiz finale and question intro (step 3)", () => {
  const l = read("src/modules/academy/components/LiveArena.tsx");
  const css = read("src/app/academy/academy.css");
  it("pillars rise 3rd, 2nd, 1st; the crown drops on #1 last; scores count up", () => {
    expect(l).toMatch(/const at = \[0\.55, 1\.0, 0\.15\]\[i\];/);
    expect(l).toMatch(/const tall = r\.rank === 1 \? 150 : r\.rank === 2 \? 108 : 78;/);
    expect(l).toMatch(/<CountUp value=\{r\.score\} duration=\{1400\} \/>/);
    expect(l).toMatch(/className=\{`acad-medal-ring acad-medal-\$\{r\.rank\}`\}/);
  });
  it("each question opens with a one-second splash that never blocks a tap", () => {
    expect(l).toMatch(/phase\.kind === "question" && now - phase\.opensAt < 1000/);
    expect(l).toMatch(/acad-qsplash pointer-events-none/);
  });
  it("still no framer layout animation in the arena (it re-renders every 250ms)", () => {
    expect(l).not.toMatch(/\blayout(Id)?=/);
  });
  it("the spotlight and splash stop under Animations: Off", () => {
    expect(css).toMatch(/html\.motion-off \.acad-spotlight \{ animation: none; \}/);
    expect(css).toMatch(/html\.motion-off \.acad-qsplash \{ display: none; \}/);
  });
});
