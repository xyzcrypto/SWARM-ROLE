import { describe, it, expect } from "vitest";
import { publicImageUrl, stripInlineImage } from "@/lib/utils";
import { parseDataUrl } from "@/lib/media";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("publicImageUrl", () => {
  it("routes an inline data: image through /api/media instead of dropping it", () => {
    // This is the whole bug: the old helper returned null here, so an uploaded
    // photo was thrown away on the way out and never rendered for anyone.
    expect(stripInlineImage(PNG_1PX)).toBeNull();
    const url = publicImageUrl(PNG_1PX, "user-1");
    expect(url).toMatch(/^\/api\/media\/avatar\/user-1\/[A-Za-z0-9]+$/);
  });

  it("keeps the blob itself out of the payload", () => {
    expect(publicImageUrl(PNG_1PX, "user-1")).not.toContain("base64");
  });

  it("puts the version in the PATH, never a query string", () => {
    // next/image rejects a local URL with a query string under the default
    // config (400 "url" parameter is not allowed) and renders a 0x0 broken
    // image. Measured: every avatar on the site was blank with `?v=`.
    expect(publicImageUrl(PNG_1PX, "u")).not.toContain("?");
  });

  it("uses the requested kind", () => {
    expect(publicImageUrl(PNG_1PX, "u", "banner")).toMatch(/^\/api\/media\/banner\/u\//);
  });

  it("leaves a real URL untouched", () => {
    const remote = "https://cdn.example.com/a.png";
    expect(publicImageUrl(remote, "user-1")).toBe(remote);
    expect(publicImageUrl("/local/a.png", "user-1")).toBe("/local/a.png");
  });

  it("returns null for empty input, or when there is no owner to build a URL from", () => {
    expect(publicImageUrl(null, "u")).toBeNull();
    expect(publicImageUrl(undefined, "u")).toBeNull();
    expect(publicImageUrl("", "u")).toBeNull();
    expect(publicImageUrl(PNG_1PX, null)).toBeNull();
    expect(publicImageUrl(PNG_1PX, undefined)).toBeNull();
  });

  it("escapes the owner id into the path", () => {
    expect(publicImageUrl(PNG_1PX, "a/b?c")).toContain("/api/media/avatar/a%2Fb%3Fc/");
  });

  it("changes the version token when the image changes, and only then", () => {
    const a = publicImageUrl(PNG_1PX, "u");
    const again = publicImageUrl(PNG_1PX, "u");
    const other = publicImageUrl(PNG_1PX.replace("iVBORw0", "iVBORw1"), "u");
    // Stable for the same image - otherwise every render would be a cache miss
    // and the `immutable` response would be pointless.
    expect(a).toBe(again);
    // ...and different for a different one, which is what makes `immutable`
    // safe: a new upload lands on a new URL rather than behind a year-old entry.
    expect(other).not.toBe(a);
  });
});

describe("parseDataUrl (the media route's decoder)", () => {
  it("decodes a well-formed image data URL", () => {
    const parsed = parseDataUrl(PNG_1PX);
    expect(parsed?.mime).toBe("image/png");
    // PNG magic bytes - proves we handed back the real decoded body.
    expect([...(parsed?.body.subarray(0, 4) ?? [])]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("refuses a non-image mime, even though the row said so", () => {
    // The route reflects a database value straight into a Content-Type header,
    // so it re-checks rather than trusting the row.
    expect(parseDataUrl("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
    expect(parseDataUrl("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
  });

  it("returns null for anything that is not a base64 data URL", () => {
    expect(parseDataUrl("https://example.com/a.png")).toBeNull();
    expect(parseDataUrl("data:image/png,notbase64")).toBeNull();
    expect(parseDataUrl("")).toBeNull();
  });
});
