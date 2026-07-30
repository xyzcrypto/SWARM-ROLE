import { describe, it, expect } from "vitest";
import { safeHref } from "@/lib/links";

// A previous fix excluded `//evil.example` but not `/\evil.example`. Both are
// resolved by the WHATWG URL parser to the same off-site address, because in a
// "special" scheme (http/https) a backslash is treated as a forward slash. The
// resolution assertions below are the point of this file: they prove the input
// really is off-site, so the safeHref expectation cannot drift from reality.

const BS = String.fromCharCode(92); // a single backslash, unambiguously

function resolvesOffSite(input: string): boolean {
  try {
    return !new URL(input, "https://xyzcrypto.io").href.startsWith("https://xyzcrypto.io");
  } catch {
    return false;
  }
}

describe("safeHref - off-site escapes disguised as internal paths", () => {
  it("blocks protocol-relative URLs", () => {
    expect(resolvesOffSite("//evil.example")).toBe(true);
    expect(safeHref("//evil.example")).toBeNull();
    expect(safeHref("//evil.example/phish")).toBeNull();
  });

  it("blocks slash + backslash, which resolves off-site identically", () => {
    const probe = "/" + BS + "evil.example";
    expect(resolvesOffSite(probe)).toBe(true);
    expect(safeHref(probe)).toBeNull();
    expect(safeHref("/" + BS + BS + "evil.example")).toBeNull();
  });

  it("blocks leading-backslash forms", () => {
    expect(safeHref(BS + "/evil.example")).toBeNull();
    expect(safeHref(BS + BS + "evil.example")).toBeNull();
  });

  it("blocks these even with leading whitespace (input is trimmed first)", () => {
    expect(safeHref("  //evil.example")).toBeNull();
    expect(safeHref("  /" + BS + "evil.example")).toBeNull();
  });
});

describe("safeHref - genuine internal paths still pass", () => {
  it("allows root-relative paths", () => {
    expect(safeHref("/")).toBe("/");
    expect(safeHref("/u/someone")).toBe("/u/someone");
    expect(safeHref("/research?tag=a/b")).toBe("/research?tag=a/b");
    expect(safeHref("/research#section")).toBe("/research#section");
  });

  it("allows the other permitted forms", () => {
    expect(safeHref("https://example.com")).toBe("https://example.com");
    expect(safeHref("http://example.com")).toBe("http://example.com");
    expect(safeHref("mailto:hi@example.com")).toBe("mailto:hi@example.com");
    expect(safeHref("#top")).toBe("#top");
  });

  it("still blocks hostile schemes", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,<script>")).toBeNull();
    expect(safeHref("vbscript:msgbox")).toBeNull();
  });

  it("every allowed root-relative path actually stays on our origin", () => {
    for (const p of ["/", "/u/someone", "/research?tag=a/b", "/research#section"]) {
      expect(safeHref(p)).toBe(p);
      expect(resolvesOffSite(p)).toBe(false);
    }
  });
});
