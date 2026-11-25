import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { rarityOf, progressOf } from "@modules/academy/components/Achievements";
import type { Me } from "@modules/academy/client/hooks";

const read = (p: string) => readFileSync(p, "utf8");

describe("Academy UI step 6: badges page", () => {
  it("rarity follows the XP a badge pays", () => {
    expect(rarityOf(25)).toBe("common");
    expect(rarityOf(100)).toBe("rare");
    expect(rarityOf(150)).toBe("epic");
    expect(rarityOf(250)).toBe("epic");
    expect(rarityOf(300)).toBe("legendary");
    expect(rarityOf(500)).toBe("legendary");
  });

  it("locked badges show real progress from /api/academy/me numbers", () => {
    const me = {
      quizzes: 0,
      answered: 42,
      streak: 3,
      bestStreak: 9,
      level: { level: 2 },
      certificates: [{ status: "issued" }, { status: "pending" }],
      progress: { byCategory: [{ slug: "defi-lending", done: 2, total: 4 }] },
    } as unknown as Me;
    expect(progressOf({ code: "answers_100" }, me)).toEqual({ have: 42, need: 100 });
    expect(progressOf({ code: "streak_7" }, me)).toEqual({ have: 9, need: 7 }); // best streak counts
    expect(progressOf({ code: "level_5" }, me)).toEqual({ have: 2, need: 5 });
    expect(progressOf({ code: "certified" }, me)).toEqual({ have: 1, need: 1 }); // pending does not count
    expect(progressOf({ code: "defi_specialist" }, me)).toEqual({ have: 2, need: 4 });
    expect(progressOf({ code: "perfect_run" }, me)).toBeNull();
  });

  it("is a static page, reachable from the Academy nav and the dashboard", () => {
    expect(read("src/app/academy/achievements/page.tsx")).not.toMatch(/force-dynamic|revalidate/);
    expect(read("src/modules/academy/components/AcademyNav.tsx")).toMatch(/href: "\/academy\/achievements", label: "Badges"/);
    expect(read("src/modules/academy/components/Dashboard.tsx")).toMatch(/href="\/academy\/achievements"/);
  });

  it("celebrates only badges new since this device last looked (first visit: last 7 days)", () => {
    const a = read("src/modules/academy/components/Achievements.tsx");
    expect(a).toMatch(/const SEEN = "xyz:academy:ach-seen";/);
    expect(a).toMatch(/seen \? !seen\.includes\(a\.code\) : new Date\(a\.earnedAt!\)\.getTime\(\) > weekAgo/);
  });
});

describe("Academy UI step 6: home and learn", () => {
  it("cards tilt from the existing tactile layer, mouse only, and reset when the pointer leaves", () => {
    const fx = read("src/modules/academy/components/AcademyFx.tsx");
    expect(fx).toMatch(/card\.classList\.contains\("acad-tilt"\)/);
    expect(fx).toMatch(/lit\.style\.removeProperty\("--rx"\);/);
    expect(read("src/modules/academy/components/AcademyHome.tsx")).toMatch(/acad-tilt acad-mode acad-acc-\$\{m\.acc\}/);
    expect(read("src/modules/academy/components/Library.tsx")).toMatch(/surface-hover acad-tilt/);
  });

  it("the learn index filters by progress and searches, keeping each track's number", () => {
    const l = read("src/modules/academy/components/LearnIndex.tsx");
    expect(l).toMatch(/\{ id: "progress", label: "In progress" \}/);
    expect(l).toMatch(/numbers=\{catalog \? new Map\(catalog\.map\(\(c, i\) => \[c\.id, i \+ 1\]\)\) : undefined\}/);
  });

  it("every new animation is off under Animations: Off", () => {
    const css = read("src/app/academy/academy.css");
    for (const c of ["acad-seg", "acad-done-check", "acad-badge-new", "acad-badge \\.acad-medal", "acad-tilt"]) expect(css, c).toMatch(new RegExp(`html\\.motion-off \\.${c}`));
  });
});
