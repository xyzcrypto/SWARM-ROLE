import { describe, it, expect } from "vitest";
import { buildObjectPath, isAllowedImageType, MAX_UPLOAD_BYTES } from "@/lib/storage";

describe("isAllowedImageType", () => {
  it("accepts common image types", () => {
    for (const t of ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]) {
      expect(isAllowedImageType(t)).toBe(true);
    }
  });
  it("rejects non-images and svg", () => {
    expect(isAllowedImageType("image/svg+xml")).toBe(false);
    expect(isAllowedImageType("application/pdf")).toBe(false);
    expect(isAllowedImageType("text/html")).toBe(false);
  });
});

describe("buildObjectPath", () => {
  it("uses the correct extension per mime", () => {
    expect(buildObjectPath("image/png")).toMatch(/^covers\/[a-z0-9-]+\.png$/);
    expect(buildObjectPath("image/jpeg")).toMatch(/^covers\/[a-z0-9-]+\.jpg$/);
  });
  it("produces unique paths", () => {
    const a = buildObjectPath("image/webp");
    const b = buildObjectPath("image/webp");
    expect(a).not.toBe(b);
  });
});

describe("MAX_UPLOAD_BYTES", () => {
  it("is 5 MB", () => {
    expect(MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
  });
});
