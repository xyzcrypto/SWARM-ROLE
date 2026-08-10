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

describe("the two online numbers must not silently disagree", () => {
  const dash = readFileSync("src/modules/dashboard/components/DashboardClient.tsx", "utf8");

  // "Live online" counts everyone via realtime (anonymous visitors get a guest
  // presence key); the list comes from the database, which only has signed-in
  // members. Side by side with no explanation, 2 vs 1 reads as a bug.
  it("the live tile says it includes guests", () => {
    expect(dash).toMatch(/including signed-out guests/);
  });

  it("the panel derives a guest count from the gap", () => {
    expect(dash).toMatch(/const guests =/);
    expect(dash).toMatch(/Math\.max\(0, liveTotal - signedIn\)/);
  });

  // Two conditions matter. Off realtime, `count` is the same database figure as
  // `signedIn`, so the gap is zero and there are no guests to report. And with
  // a truncated list the gap is part hidden members, part guests, with no
  // honest way to split it - so it must not be labelled "guests".
  it("only claims a guest count when realtime is the source AND the list is complete", () => {
    expect(dash).toMatch(/live && !truncated &&/);
  });

  // The cap applies to members, so the "showing X of Y" figure must compare
  // against the signed-in total, never the guest-inclusive live count.
  it("compares the capped list against the signed-in total, not the live count", () => {
    expect(dash).toMatch(/showing \$\{visitors\.length\} of \$\{signedIn\}/);
  });
});
