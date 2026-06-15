import { describe, it, expect } from "vitest";
import { buildObjectPath, isAllowedImageType, MAX_UPLOAD_BYTES, sniffImageType } from "@/lib/storage";

function bufOf(bytes: number[]): ArrayBuffer {
  // Pad to >=12 bytes (sniffImageType requires a minimum header length).
  const arr = new Uint8Array(16);
  arr.set(bytes);
  return arr.buffer;
}

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

describe("sniffImageType (magic-byte validation)", () => {
  it("detects JPEG / PNG / GIF from their signatures", () => {
    expect(sniffImageType(bufOf([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
    expect(sniffImageType(bufOf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(bufOf([0x47, 0x49, 0x46, 0x38]))).toBe("image/gif");
  });

  it("detects WEBP (RIFF....WEBP) and AVIF (ftyp+avif)", () => {
    const webp = new Uint8Array(16);
    webp.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
    webp.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
    expect(sniffImageType(webp.buffer)).toBe("image/webp");

    const avif = new Uint8Array(16);
    avif.set([0x66, 0x74, 0x79, 0x70], 4); // ftyp
    avif.set([0x61, 0x76, 0x69, 0x66], 8); // avif
    expect(sniffImageType(avif.buffer)).toBe("image/avif");
  });

  it("rejects a non-image (e.g. a renamed file) and too-short input", () => {
    expect(sniffImageType(bufOf([0x25, 0x50, 0x44, 0x46]))).toBeNull(); // %PDF
    expect(sniffImageType(new Uint8Array(4).buffer)).toBeNull(); // < 12 bytes
  });
});
