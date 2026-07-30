import { describe, it, expect } from "vitest";
import { markdownToHtml } from "@/lib/richtext";

// richtext.ts builds an HTML *string* (unlike lib/markdown.tsx, which builds
// React elements and is therefore escaped by the framework). That makes it the
// one markdown path with no sanitiser behind it, so it must apply the shared
// safeHref check itself. It previously did not.

describe("markdownToHtml - link protocol validation", () => {
  it("keeps safe links as anchors", () => {
    expect(markdownToHtml("[x](https://example.com)")).toContain('<a href="https://example.com">x</a>');
    expect(markdownToHtml("[x](/research)")).toContain('<a href="/research">x</a>');
    expect(markdownToHtml("[x](mailto:a@b.com)")).toContain('<a href="mailto:a@b.com">x</a>');
  });

  it("degrades an unsafe scheme to plain text instead of an anchor", () => {
    const out = markdownToHtml("[click me](javascript:alert(1))");
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("<a ");
    expect(out).toContain("click me"); // label survives, link does not
  });

  it("blocks data: and vbscript: schemes too", () => {
    expect(markdownToHtml("[x](data:text/html,<script>)")).not.toContain("<a ");
    expect(markdownToHtml("[x](vbscript:msgbox)")).not.toContain("<a ");
  });

  it("blocks off-site escapes disguised as internal paths", () => {
    const BS = String.fromCharCode(92);
    expect(markdownToHtml("[x](//evil.example)")).not.toContain("<a ");
    expect(markdownToHtml("[x](/" + BS + "evil.example)")).not.toContain("<a ");
  });

  it("still escapes the href it does emit", () => {
    // A quote in the URL must not be able to close the attribute early.
    const out = markdownToHtml('[x](https://a.example/?q=")');
    expect(out).not.toMatch(/href="[^"]*"[^>]*"/);
    expect(out).toContain("&quot;");
  });
});
