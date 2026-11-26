import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { heatLevel } from "@modules/academy/components/LearningHeatmap";

const read = (p: string) => readFileSync(p, "utf8");

describe("interactive profile", () => {
  it("the learning calendar shades days in five steps of XP", () => {
    expect([0, 10, 24, 25, 99, 100, 249, 250, 900].map(heatLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
  it("calendar data is 26 weeks of XP per UTC day from one grouped ledger read", () => {
    const a = read("src/modules/academy/lib/profile-activity.ts");
    expect(a).toMatch(/export const HEAT_DAYS = 26 \* 7;/);
    expect(a).toMatch(/GROUP BY 1/);
    expect(a).toMatch(/"createdAt" AT TIME ZONE 'UTC'/);
  });
  it("sections are tabs with hash deep links, read after mount (no hydration mismatch)", () => {
    const t = read("src/modules/profile/components/ProfileTabs.tsx");
    expect(t).toMatch(/const id = setTimeout\(fromHash, 0\);/);
    expect(t).toMatch(/history\.replaceState\(null, "", id === tabs\[0\]\?\.id \? window\.location\.pathname : `#\$\{id\}`\)/);
    expect(read("src/app/u/[username]/page.tsx")).toMatch(/<ProfileTabs/);
  });
  it("visitors can challenge the member to their latest replayable quiz", () => {
    expect(read("src/modules/academy/lib/profile-activity.ts")).toMatch(/mode: \{ notIn: \["daily", "weekly", "mistakes"\] \}/);
    expect(read("src/modules/academy/components/ProfileAcademy.tsx")).toMatch(/href=\{`\/academy\/quiz\?challenge=\$\{a\.challenge\.id\}`\}/);
  });
});
