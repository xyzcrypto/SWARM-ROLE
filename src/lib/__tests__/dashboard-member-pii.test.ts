import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { hasPermission, isStaff } from "@modules/settings/lib/permissions";

// The dashboard page serializes member rows (full emails, last-login times) into
// its payload. Entering the dashboard only needs *any* staff capability, so the
// rows must be gated on the capability that owns them, not on the hidden tab.
const page = readFileSync("src/app/dashboard/page.tsx", "utf8");

describe("dashboard member rows are gated by capability", () => {
  it("loads recent members only with users:manage and Premium members only with premium:manage", () => {
    expect(page).toMatch(/canSeeMembers = hasPermission\(me, "users:manage"\)/);
    expect(page).toMatch(/canSeePremium = hasPermission\(me, "premium:manage"\)/);
    expect(page).toMatch(/canSeeMembers \? prisma\.user\.findMany\(/);
    expect(page).toMatch(/canSeePremium\s*\? prisma\.user\.findMany\(/);
  });

  it("never queries member rows unconditionally", () => {
    const unguarded = page.split("\n").filter((l) => /prisma\.user\.findMany\(/.test(l) && !/canSee(Members|Premium)/.test(l) && !/^\s*\? /.test(l));
    expect(unguarded).toEqual([]);
  });

  it("a staff member holding only an unrelated capability gets in but holds neither", () => {
    const whatsNewOnly = { permissions: ["whatsnew:manage"] };
    expect(isStaff(whatsNewOnly)).toBe(true);
    expect(hasPermission(whatsNewOnly, "users:manage")).toBe(false);
    expect(hasPermission(whatsNewOnly, "premium:manage")).toBe(false);
    expect(hasPermission({ isSuperAdmin: true }, "users:manage")).toBe(true);
  });
});
