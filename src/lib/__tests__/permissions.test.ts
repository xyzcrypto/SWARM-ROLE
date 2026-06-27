import { describe, it, expect } from "vitest";
import {
  hasPermission,
  isSuperAdmin,
  isStaff,
  sanitizePermissions,
  ALL_PERMISSIONS,
  isPermission,
} from "@/lib/permissions";

describe("isSuperAdmin", () => {
  it("treats the isSuperAdmin flag and legacy role=ADMIN as super admin", () => {
    expect(isSuperAdmin({ isSuperAdmin: true })).toBe(true);
    expect(isSuperAdmin({ role: "ADMIN" })).toBe(true);
    expect(isSuperAdmin({ role: "USER", permissions: ["post:publish"] })).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
  });
});

describe("hasPermission", () => {
  it("grants Super Admins every capability", () => {
    const su = { isSuperAdmin: true };
    for (const p of ALL_PERMISSIONS) expect(hasPermission(su, p)).toBe(true);
  });

  it("grants staff only their listed capabilities", () => {
    const staff = { role: "USER", permissions: ["post:publish", "whatsnew:manage"] };
    expect(hasPermission(staff, "post:publish")).toBe(true);
    expect(hasPermission(staff, "whatsnew:manage")).toBe(true);
    expect(hasPermission(staff, "users:roles")).toBe(false);
    expect(hasPermission(staff, "premium:manage")).toBe(false);
  });

  it("denies everything for anonymous / empty principals", () => {
    expect(hasPermission(null, "dashboard:view")).toBe(false);
    expect(hasPermission({ role: "USER", permissions: [] }, "dashboard:view")).toBe(false);
  });
});

describe("isStaff", () => {
  it("is true for super admins and anyone with >=1 permission", () => {
    expect(isStaff({ isSuperAdmin: true })).toBe(true);
    expect(isStaff({ role: "USER", permissions: ["dashboard:view"] })).toBe(true);
    expect(isStaff({ role: "USER", permissions: [] })).toBe(false);
    expect(isStaff(null)).toBe(false);
  });
});

describe("sanitizePermissions", () => {
  it("keeps only valid catalog entries and de-dupes", () => {
    expect(sanitizePermissions(["post:publish", "post:publish", "nonsense", 42, "users:roles"])).toEqual([
      "post:publish",
      "users:roles",
    ]);
    expect(sanitizePermissions("not-an-array")).toEqual([]);
    expect(sanitizePermissions(null)).toEqual([]);
  });
});

describe("isPermission", () => {
  it("validates against the catalog", () => {
    expect(isPermission("post:publish")).toBe(true);
    expect(isPermission("does:not-exist")).toBe(false);
    expect(isPermission(undefined)).toBe(false);
  });
});
