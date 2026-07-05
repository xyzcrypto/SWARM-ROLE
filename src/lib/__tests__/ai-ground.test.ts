import { describe, expect, it } from "vitest";
import {
  buildAssistantSystemPrompt,
  buildCorpus,
  rankPosts,
  MAX_ARTICLES,
  MAX_CORPUS_CHARS,
  type GroundingPost,
} from "@/lib/ai-ground";

const post = (over: Partial<GroundingPost>): GroundingPost => ({
  title: "Untitled",
  slug: "untitled",
  excerpt: "An excerpt.",
  content: "Body content.",
  ...over,
});

describe("rankPosts", () => {
  it("preserves order when the query has no meaningful terms", () => {
    const posts = [post({ slug: "a" }), post({ slug: "b" }), post({ slug: "c" })];
    expect(rankPosts(posts, "what is the").map((p) => p.slug)).toEqual(["a", "b", "c"]);
  });

  it("ranks a title keyword match above a body-only match", () => {
    const posts = [
      post({ slug: "body", title: "General", excerpt: "x", content: "mentions airdrop once" }),
      post({ slug: "title", title: "Airdrop farming guide", excerpt: "x", content: "y" }),
    ];
    expect(rankPosts(posts, "airdrop").map((p) => p.slug)).toEqual(["title", "body"]);
  });

  it("does not mutate the input array", () => {
    const posts = [post({ slug: "a", title: "zeta" }), post({ slug: "b", title: "airdrop" })];
    const copy = [...posts];
    rankPosts(posts, "airdrop");
    expect(posts).toEqual(copy);
  });

  it("uses incoming order as the tie-breaker", () => {
    const posts = [post({ slug: "first" }), post({ slug: "second" })];
    expect(rankPosts(posts, "airdrop").map((p) => p.slug)).toEqual(["first", "second"]);
  });
});

describe("buildCorpus", () => {
  it("includes each article's /research link and title", () => {
    const corpus = buildCorpus([post({ slug: "perp-dex", title: "Perp DEX 101" })], "perp");
    expect(corpus).toContain("Perp DEX 101");
    expect(corpus).toContain("/research/perp-dex");
  });

  it("caps the number of articles at MAX_ARTICLES", () => {
    const many = Array.from({ length: MAX_ARTICLES + 5 }, (_, i) =>
      post({ slug: `p${i}`, title: `Post ${i}` })
    );
    const corpus = buildCorpus(many, "");
    const count = (corpus.match(/\/research\//g) ?? []).length;
    expect(count).toBe(MAX_ARTICLES);
  });

  it("respects the character budget", () => {
    const big = post({ slug: "big", content: "x".repeat(50_000) });
    const corpus = buildCorpus([big, post({ slug: "two" })], "");
    // First article always included; budget stops the rest.
    expect(corpus.length).toBeLessThanOrEqual(MAX_CORPUS_CHARS + 2_500);
    expect(corpus).toContain("/research/big");
  });

  it("returns an empty string with no posts", () => {
    expect(buildCorpus([], "anything")).toBe("");
  });
});

describe("buildAssistantSystemPrompt", () => {
  it("embeds the persona and grounding rules", () => {
    const sys = buildAssistantSystemPrompt([post({ slug: "s" })], "hi");
    expect(sys).toContain("XYZ AI");
    expect(sys).toContain("research assistant");
    expect(sys.toLowerCase()).toContain("not financial advice");
  });

  it("notes an empty library when there are no posts", () => {
    const sys = buildAssistantSystemPrompt([], "hi");
    expect(sys.toLowerCase()).toContain("empty");
  });

  it("includes the grounding corpus when posts exist", () => {
    const sys = buildAssistantSystemPrompt([post({ slug: "grounded", title: "Grounded" })], "grounded");
    expect(sys).toContain("/research/grounded");
  });
});
