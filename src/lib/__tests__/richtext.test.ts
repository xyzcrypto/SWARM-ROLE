import { describe, expect, it } from "vitest";
import { markdownToHtml } from "@/lib/richtext";

describe("markdownToHtml", () => {
  it("renders headings", () => {
    expect(markdownToHtml("# Big\n## Medium\n### Small")).toBe(
      "<h1>Big</h1><h2>Medium</h2><h3>Small</h3>"
    );
  });

  it("renders bold, italic and inline code", () => {
    expect(markdownToHtml("**bold** and *italic* and `code`")).toBe(
      "<p><strong>bold</strong> and <em>italic</em> and <code>code</code></p>"
    );
  });

  it("renders a list", () => {
    expect(markdownToHtml("- one\n- two")).toBe("<ul><li>one</li><li>two</li></ul>");
  });

  it("renders a blockquote", () => {
    expect(markdownToHtml("> a quote")).toBe("<blockquote>a quote</blockquote>");
  });

  it("renders a link", () => {
    expect(markdownToHtml("[XYZ](https://xyzcrypto.io)")).toBe(
      '<p><a href="https://xyzcrypto.io">XYZ</a></p>'
    );
  });

  it("renders a curated color span", () => {
    expect(markdownToHtml("{c:gold}shiny{/c}")).toBe('<p><span class="text-gold-300">shiny</span></p>');
  });

  it("escapes raw HTML in plain text", () => {
    expect(markdownToHtml("<script>alert(1)</script>")).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  });

  it("returns an empty string for empty content", () => {
    expect(markdownToHtml("")).toBe("");
  });

  it("escapes quotes in a link href so it can't break out of the attribute", () => {
    const html = markdownToHtml('[x](https://evil.test/" onmouseover="alert(1))');
    expect(html).not.toContain('" onmouseover="');
    expect(html).toContain("&quot; onmouseover=&quot;");
  });

  // Regression: bolding a phrase then italicizing part of it (two Tiptap toolbar
  // clicks) serializes as "**hello *world***" - the bold alternative's old
  // `[^*]+` content class couldn't match across the nested italic's `*`, so it
  // fell through to the wrong `*...*` pair and dropped bold + leaked literal
  // asterisks. Reopening a post for edit re-hydrated this string through
  // markdownToHtml, so the corruption was visible immediately on "Edit".
  it("supports italic nested inside bold (overlapping-delimiter round trip)", () => {
    expect(markdownToHtml("**hello *world***")).toBe(
      "<p><strong>hello <em>world</em></strong></p>"
    );
  });

  it("supports the standard bold+italic triple-star shorthand", () => {
    expect(markdownToHtml("***triple***")).toBe("<p><strong><em>triple</em></strong></p>");
  });

  it("still renders two independent bold spans on one line without merging them", () => {
    expect(markdownToHtml("**foo** and **bar**")).toBe(
      "<p><strong>foo</strong> and <strong>bar</strong></p>"
    );
  });
});
