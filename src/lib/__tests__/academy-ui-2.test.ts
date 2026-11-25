import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

describe("quiz feel (step 2)", () => {
  const q = read("src/modules/academy/components/QuizClient.tsx");
  const css = read("src/app/academy/academy.css");
  it("a right answer bursts from the option, bigger on a streak", () => {
    expect(q).toMatch(/burstConfetti\(\{ x: b\.left \+ b\.width \* 0\.15, y: b\.top \+ b\.height \/ 2 \}, r\.run >= 3 \? 60 : 26\)/);
  });
  it("the card washes mint or red on the reveal", () => {
    expect(q).toMatch(/reveal && \(reveal\.correct \? "acad-flash-right" : "acad-flash-wrong"\)/);
  });
  it("the combo pill heats up at 3 and blazes at 5", () => {
    expect(q).toMatch(/state\.run >= 5 \? "is-blaze" : state\.run >= 3 \? "is-hot" : ""/);
  });
  it("a wrong pick shakes with `translate`, so it composes with the transforms already on the option", () => {
    expect(css).toMatch(/\.acad-option\.is-wrong \{ animation: acad-shake/);
    expect(css).toMatch(/30%, 50%, 70% \{ translate: -7px 0; \}/);
  });
  it("the timer throbs red in its last seconds, and every new effect stops under Animations: Off", () => {
    expect(q).toMatch(/urgent && "acad-timer-hot acad-timer-glow"/);
    expect(css).toMatch(/html\.motion-off \.acad-option\.is-wrong,/);
  });
});
