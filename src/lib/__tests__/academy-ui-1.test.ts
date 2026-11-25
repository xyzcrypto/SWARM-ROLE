import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

describe("live quiz banner on every Academy page", () => {
  const b = read("src/modules/academy/components/LiveBanner.tsx");
  it("is mounted by the Academy layout under the tab bar", () => {
    expect(read("src/app/academy/layout.tsx")).toMatch(/<AcademyNav \/>\s*<LiveBanner \/>/);
  });
  it("one cached request per mount, no polling; the clock lives in state, never read during render", () => {
    expect(b.match(/getJson<\{ quizzes: LiveListItem\[\] \}>\("\/api\/academy\/live"\)/g)?.length).toBe(2);
    expect(b).toMatch(/const tick = \(\) => setNow\(Date\.now\(\)\);/);
    expect(b).not.toMatch(/useTicker/);
    // retries only around the start, a bounded number of times
    expect(b).toMatch(/if \(\+\+tries > 6\) return clearInterval\(id\);/);
  });
  it("stays out of the live room itself and can be dismissed per quiz", () => {
    expect(b).toMatch(/path\.startsWith\("\/academy\/live\/"\)/);
    expect(b).toMatch(/sessionStorage\.setItem\(DISMISS, pick\.q\.id\)/);
  });
  it("never ships time-dependent HTML from the server (renders nothing until data arrives)", () => {
    expect(b).toMatch(/if \(!items \|\| !now\) return null;/);
  });
  it("animations stop under Animations: Off", () => {
    expect(read("src/app/academy/academy.css")).toMatch(/html\.motion-off \.acad-live-banner/);
  });
});
