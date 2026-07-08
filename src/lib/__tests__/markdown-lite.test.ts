import { describe, expect, it } from "vitest";
import { stripMarkdown } from "@/lib/strip-markdown";

describe("stripMarkdown", () => {
  it("removes headings, bullets, ordered markers and blockquotes", () => {
    const md = "## What happened\n- first point\n- second point\n1. step one\n> a quote";
    const out = stripMarkdown(md);
    expect(out).not.toMatch(/[#>*]/);
    expect(out).not.toMatch(/^\s*-/m);
    expect(out).toContain("What happened");
    expect(out).toContain("first point");
    expect(out).toContain("step one");
    expect(out).toContain("a quote");
  });
  it("unwraps bold/italic/code and collapses whitespace", () => {
    expect(stripMarkdown("**Bitcoin** is *up* and `stable`")).toBe("Bitcoin is up and stable");
  });
  it("turns paragraph breaks into sentence pauses (no doubled periods)", () => {
    expect(stripMarkdown("Line one.\n\nLine two.")).toBe("Line one. Line two.");
    expect(stripMarkdown("No period\n\nNext")).toBe("No period. Next");
  });
  it("is safe on empty input", () => {
    expect(stripMarkdown("")).toBe("");
  });
});
