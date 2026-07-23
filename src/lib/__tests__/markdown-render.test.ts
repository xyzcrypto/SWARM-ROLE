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
});
