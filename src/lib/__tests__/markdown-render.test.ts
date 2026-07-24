import { describe, it, expect } from "vitest";
import { Markdown } from "@/lib/markdown";

// Markdown() returns plain React element objects (no DOM needed) - inspect
// .type/.props directly rather than rendering, matching this repo's
// jsdom-free vitest setup.
function blocksOf(content: string) {
  const el = Markdown({ content }) as any;
  return el.props.children as any[];
}

describe("Markdown headings", () => {
  it("renders '# ' as a real <h1> (was silently downgraded to <h2>)", () => {
    const [block] = blocksOf("# Top heading");
    expect(block.type).toBe("h1");
  });
  it("still renders '## '/'### ' as <h2>/<h3>", () => {
    expect(blocksOf("## Sub")[0].type).toBe("h2");
    expect(blocksOf("### Minor")[0].type).toBe("h3");
  });
});

describe("Markdown color spans", () => {
  it("renders {c:color}text{/c} as a span with the matching color class", () => {
    const [p] = blocksOf("Some {c:gold}highlighted{/c} text.");
    const inlineChildren = p.props.children as any[];
    const span = inlineChildren.find((c) => c?.type === "span");
    expect(span).toBeTruthy();
    expect(span.props.className).toBe("text-gold-300");
    expect(span.props.children).toEqual(["highlighted"]);
  });
  it("supports bold inside a color span", () => {
    const [p] = blocksOf("{c:mint}**bold and mint**{/c}");
    const inlineChildren = p.props.children as any[];
    const span = inlineChildren.find((c) => c?.type === "span");
    const inner = span.props.children as any[];
    expect(inner[0].type).toBe("strong");
  });
  it("ignores an unknown color key (renders as plain text, no crash)", () => {
    expect(() => blocksOf("{c:purple}nope{/c}")).not.toThrow();
    const [p] = blocksOf("{c:purple}nope{/c}");
    const inlineChildren = p.props.children as any[];
    expect(inlineChildren.some((c) => c?.type === "span")).toBe(false);
  });

  // Regression: a real editor (Tiptap) lets a user apply Bold and a color to
  // the same selection, which can serialize as bold WRAPPING the color tag
  // (the reverse of the case above). The renderer used to slice bold/italic
  // content as a raw string instead of recursing, so the {c:...}...{/c}
  // syntax leaked onto the page as literal visible text instead of coloring.
  it("supports a color span inside bold (the reverse nesting)", () => {
    const [p] = blocksOf("**{c:mint}bold and mint{/c}**");
    const inlineChildren = p.props.children as any[];
    const strong = inlineChildren.find((c) => c?.type === "strong");
    expect(strong).toBeTruthy();
    const inner = strong.props.children as any[];
    const span = inner.find((c) => c?.type === "span");
    expect(span).toBeTruthy();
    expect(span.props.className).toBe("text-mint-300");
  });

  it("supports a color span inside italic", () => {
    const [p] = blocksOf("*{c:red}italic and red{/c}*");
    const inlineChildren = p.props.children as any[];
    const em = inlineChildren.find((c) => c?.type === "em");
    const inner = em.props.children as any[];
    expect(inner.find((c) => c?.type === "span").props.className).toBe("text-rose-400");
  });

  it("supports formatted text inside a link label", () => {
    const [p] = blocksOf("[**bold link**](https://example.com)");
    const inlineChildren = p.props.children as any[];
    const a = inlineChildren.find((c) => c?.type === "a");
    const inner = a.props.children as any[];
    expect(inner.find((c) => c?.type === "strong")).toBeTruthy();
  });

  // Regression: bolding a phrase then italicizing part of it inside Tiptap
  // serializes as "**hello *world***" - the bold alternative's old `[^*]+`
  // content class couldn't match across the nested italic's `*`, so the parser
  // fell through to the wrong `*...*` pair, dropped the bold wrapper, and
  // leaked literal `*`/`***` characters as visible text on the published post.
  it("supports italic nested inside bold (overlapping-delimiter round trip)", () => {
    const [p] = blocksOf("**hello *world***");
    const inlineChildren = p.props.children as any[];
    const strong = inlineChildren.find((c) => c?.type === "strong");
    expect(strong).toBeTruthy();
    const inner = strong.props.children as any[];
    expect(inner[0]).toBe("hello ");
    expect(inner.find((c) => c?.type === "em")?.props.children).toEqual(["world"]);
  });

  it("still renders two independent bold spans on one line without merging them", () => {
    const [p] = blocksOf("**foo** and **bar**");
    const inlineChildren = p.props.children as any[];
    const strongs = inlineChildren.filter((c) => c?.type === "strong");
    expect(strongs).toHaveLength(2);
    expect(strongs[0].props.children).toEqual(["foo"]);
    expect(strongs[1].props.children).toEqual(["bar"]);
  });
});
