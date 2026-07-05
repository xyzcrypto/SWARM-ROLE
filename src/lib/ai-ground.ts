// XYZ AI — grounding helpers (pure, client-safe, no server imports so they're
// trivially unit-testable). The route fetches published research from the DB and
// passes it here to build the system prompt that anchors the assistant to the
// site's own content.

export type GroundingPost = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  premium?: boolean;
};

// Keep the corpus bounded so token cost per turn stays predictable regardless of
// how many articles exist. Newest/most-relevant articles are included until this
// budget is spent.
export const MAX_CORPUS_CHARS = 12_000;
// Per-article body slice — enough to answer from, small enough to fit several.
export const MAX_ARTICLE_CHARS = 2_000;
// How many articles at most, even if the char budget allows more.
export const MAX_ARTICLES = 8;

const STOP = new Set([
  "the", "a", "an", "of", "to", "in", "is", "it", "and", "or", "for", "on",
  "what", "how", "why", "who", "when", "which", "with", "about", "does", "do",
  "can", "will", "are", "was", "this", "that", "i", "you", "me", "my", "please",
]);

function terms(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 2 && !STOP.has(t));
}

/**
 * Rank posts by keyword overlap with the query (title/excerpt weighted higher
 * than body), preserving the incoming order (assumed newest-first) as the
 * tie-breaker. Returns a new array; never mutates the input.
 */
export function rankPosts(posts: GroundingPost[], query: string): GroundingPost[] {
  const q = terms(query);
  if (q.length === 0) return [...posts];
  const qset = new Set(q);
  const scored = posts.map((p, i) => {
    const title = terms(p.title);
    const meta = terms(`${p.excerpt}`);
    const body = terms(p.content).slice(0, 400); // cap scan for perf
    let score = 0;
    for (const t of title) if (qset.has(t)) score += 3;
    for (const t of meta) if (qset.has(t)) score += 2;
    for (const t of body) if (qset.has(t)) score += 1;
    return { p, score, i };
  });
  scored.sort((a, b) => (b.score - a.score) || (a.i - b.i));
  return scored.map((s) => s.p);
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : clean.slice(0, max).trimEnd() + "…";
}

/**
 * Build the labelled article corpus block, capped to MAX_ARTICLES /
 * MAX_CORPUS_CHARS. Each article carries its /research/<slug> link so the model
 * can cite sources. Ranked by relevance to `query`.
 */
export function buildCorpus(posts: GroundingPost[], query: string): string {
  const ranked = rankPosts(posts, query);
  const blocks: string[] = [];
  let used = 0;
  for (const p of ranked) {
    if (blocks.length >= MAX_ARTICLES) break;
    const body = truncate(p.content, MAX_ARTICLE_CHARS);
    const block =
      `### ${p.title}\n` +
      `Link: /research/${p.slug}\n` +
      `Summary: ${truncate(p.excerpt, 300)}\n` +
      `${body}`;
    if (used + block.length > MAX_CORPUS_CHARS && blocks.length > 0) break;
    blocks.push(block);
    used += block.length;
  }
  return blocks.join("\n\n---\n\n");
}

/**
 * The full system prompt: house persona + grounding corpus + answering rules.
 * When there are no articles, the assistant still answers from general crypto
 * knowledge but is told the research library is empty.
 */
export function buildAssistantSystemPrompt(posts: GroundingPost[], query: string): string {
  const corpus = buildCorpus(posts, query);
  const persona =
    "You are XYZ AI, the research assistant for XYZ Crypto — a premium Web3 " +
    "research hub. You help members understand crypto, DeFi, Web3 and the site's " +
    "own published research. Be precise, concise and professional; use plain " +
    "language and short paragraphs. Format answers in simple markdown.";
  const rules = [
    "When the answer is covered by the XYZ Crypto research below, ground your reply in it and cite the article using its markdown link, e.g. [Title](/research/slug).",
    "You may add widely-accepted general crypto knowledge, but never invent XYZ Crypto articles, data, prices or facts that are not provided.",
    "If something isn't covered by the research and you're unsure, say so plainly rather than guessing.",
    "This is not financial advice — never tell users to buy or sell a specific asset; frame things as research and education.",
    "Keep answers focused on crypto/Web3/the XYZ Crypto platform; politely decline unrelated requests.",
  ];
  const library = corpus
    ? `XYZ Crypto research library (your grounding source):\n\n${corpus}`
    : "XYZ Crypto research library is currently empty — answer from general crypto knowledge and invite the member to check back as research is published.";
  return `${persona}\n\nRules:\n- ${rules.join("\n- ")}\n\n${library}`;
}
