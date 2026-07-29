import { describe, it, expect } from "vitest";
import { safeHref, cleanBareUrl } from "@/lib/links";

describe("safeHref", () => {
  it("allows http/https/mailto/relative/anchor", () => {
    expect(safeHref("https://xyzcrypto.io")).toBe("https://xyzcrypto.io");
    expect(safeHref("http://example.com")).toBe("http://example.com");
    expect(safeHref("mailto:hi@xyzcrypto.io")).toBe("mailto:hi@xyzcrypto.io");
    expect(safeHref("/research")).toBe("/research");
    expect(safeHref("#section")).toBe("#section");
  });
  it("blocks dangerous protocols (XSS)", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("JaVaScRiPt:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,<script>")).toBeNull();
    expect(safeHref("vbscript:msgbox")).toBeNull();
  });
  it("blocks protocol-relative URLs, which resolve off-site", () => {
    // `//evil.example` is not a root-relative path - the browser resolves it as
    // https://evil.example, so it must not pass as an internal link.
    expect(safeHref("//evil.example")).toBeNull();
    expect(safeHref("//evil.example/phish")).toBeNull();
    expect(safeHref("  //evil.example")).toBeNull(); // trimmed before the test
  });
  it("still allows genuine root-relative paths", () => {
    expect(safeHref("/")).toBe("/");
    expect(safeHref("/u/someone")).toBe("/u/someone");
    expect(safeHref("/research?tag=a/b")).toBe("/research?tag=a/b"); // inner slashes fine
  });
});

describe("cleanBareUrl", () => {
  it("trims trailing punctuation from pasted URLs", () => {
    expect(cleanBareUrl("https://x.com/abc.")).toBe("https://x.com/abc");
    expect(cleanBareUrl("https://x.com/abc,")).toBe("https://x.com/abc");
    expect(cleanBareUrl("https://x.com/abc)")).toBe("https://x.com/abc");
    expect(cleanBareUrl("https://x.com/abc!?")).toBe("https://x.com/abc");
  });
  it("keeps clean URLs untouched (incl. query strings)", () => {
    expect(cleanBareUrl("https://x.com/a?b=1&c=2")).toBe("https://x.com/a?b=1&c=2");
    expect(cleanBareUrl("https://x.com/path/page")).toBe("https://x.com/path/page");
  });
});
