import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// The presence route is admin-gated, but "admin-gated" is not a reason to widen
// what it returns. These pin the shape of the who-is-online list.
const route = readFileSync("src/app/api/presence/route.ts", "utf8");

describe("the online-visitors list", () => {
  it("never selects an email", () => {
    // Member emails are not exposed anywhere without a reason, and a presence
    // list has none - a name, handle and avatar are enough to act on.
    const select = route.match(/user:\s*\{\s*select:\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(select).not.toMatch(/email/);
    expect(select).toMatch(/username/);
  });

  it("stays admin-only and out of any shared cache", () => {
    expect(route).toMatch(/getAdminSession\(\)/);
    expect(route).toMatch(/private, no-store/);
  });

  it("caps the list so one dashboard cannot pull unbounded rows", () => {
    const cap = Number(route.match(/ONLINE_LIST_LIMIT\s*=\s*(\d+)/)?.[1]);
    expect(cap).toBeGreaterThan(0);
    expect(cap).toBeLessThanOrEqual(100);
    expect(route).toMatch(/take: ONLINE_LIST_LIMIT/);
  });

  // The cap must never make the site look quieter than it is: the count comes
  // from a separate COUNT over the same window, so a truncated list still
  // reports the real total.
  it("keeps the count independent of the capped list", () => {
    expect(route).toMatch(/\.count\(\{ where: \{ seenAt: \{ gte: since \} \} \}\)/);
    expect(route).toMatch(/truncated:/);
  });
});
