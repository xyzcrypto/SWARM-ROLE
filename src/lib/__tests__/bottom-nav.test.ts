import { describe, expect, it } from "vitest";
import { isBottomActive, isBottomHidden } from "@/lib/bottom-nav";

describe("isBottomActive", () => {
  it("matches the exact route", () => {
    expect(isBottomActive("/markets", "/markets")).toBe(true);
    expect(isBottomActive("/news", "/markets")).toBe(false);
  });
  it("matches sub-routes", () => {
    expect(isBottomActive("/research/some-post", "/research")).toBe(true);
    expect(isBottomActive("/markets/bitcoin", "/markets")).toBe(true);
  });
  it("does not match a prefix that isn't a path segment", () => {
    expect(isBottomActive("/newsroom", "/news")).toBe(false);
  });
});

describe("isBottomHidden", () => {
  it("hides on immersive/auth/admin routes", () => {
    expect(isBottomHidden("/community")).toBe(true);
    expect(isBottomHidden("/login")).toBe(true);
    expect(isBottomHidden("/dashboard")).toBe(true);
    expect(isBottomHidden("/research/x")).toBe(false);
    expect(isBottomHidden("/markets")).toBe(false);
    expect(isBottomHidden("/")).toBe(false);
  });
});
