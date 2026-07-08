// XYZ AI — pure prompt builders + output parsers for the article-summary and
// chat-moderation tasks. No server imports, so they're trivially unit-testable.
// The actual model calls live in src/lib/ai-tasks.ts.

// Cap the article body we send so token cost per summary stays predictable.
export const MAX_SUMMARY_INPUT = 6000;
export const MAX_SUMMARY_OUTPUT = 400;

/** Prompt for a short, neutral TL;DR of a research article. */
export function buildSummaryPrompt(title: string, content: string): string {
  const body = content.replace(/\s+/g, " ").trim().slice(0, MAX_SUMMARY_INPUT);
  return (
    "Summarise this XYZ Crypto research article as a TL;DR for readers: 1–2 short, " +
    "plain-English sentences, neutral and factual, at most 45 words. No preamble, " +
    'no "This article", no markdown — just the summary sentence(s).\n\n' +
    `Title: ${title}\n\nArticle:\n${body}`
  );
}

/** Tidy a model summary: strip wrapping quotes / a leading "TL;DR:" label / caps. */
export function cleanSummary(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^["'`]+|["'`]+$/g, "").trim();
  s = s.replace(/^(tl;?\s*dr|summary)\s*[:\-–—]\s*/i, "").trim();
  return s.slice(0, MAX_SUMMARY_OUTPUT).trim();
}

/**
 * Prompt for chat auto-moderation. The model must answer with a single word so
 * parsing is trivial; it's told to default to SAFE when unsure (conservative —
 * we never want to over-hide legitimate messages).
 */
export function buildModerationPrompt(text: string): string {
  return (
    "You are a moderator for a crypto community chat. Classify the MESSAGE. Reply " +
    'with exactly one word: "TOXIC" if it contains hate speech, harassment, threats, ' +
    "sexual abuse, or an obvious scam/phishing link; otherwise reply \"SAFE\". " +
    'Ordinary crypto talk, criticism, slang and profanity are "SAFE". When unsure, ' +
    'reply "SAFE".\n\nMESSAGE: ' +
    text
  );
}

/** True only when the verdict is a clear TOXIC (fail-safe: anything else = not toxic). */
export function parseModerationVerdict(raw: string): boolean {
  const v = raw.toLowerCase();
  return /\btoxic\b/.test(v) && !/\bsafe\b/.test(v);
}

/** Prompt for a punchy "why this matters" take on a news headline (for the News hub). */
export function buildWhyMattersPrompt(title: string, summary: string): string {
  return (
    "You are XYZ AI, a crypto analyst. In 2 short sentences, explain WHY this news " +
    "matters for the crypto market and who it affects — practical and plain, no hype, " +
    "no preamble, not financial advice.\n\n" +
    `Headline: ${title}\n` +
    (summary ? `Summary: ${cleanSummary(summary).slice(0, 500)}\n` : "")
  );
}

/**
 * A full, structured on-site briefing so a reader gets the WHOLE story without
 * leaving the site. Returns light markdown (a TL;DR line, a "## Key points"
 * bullet list, "## Context" and "## Why it matters" sections). Neutral,
 * education-only, never financial advice.
 */
export function buildNewsBriefingPrompt(title: string, summary: string): string {
  return (
    "You are XYZ AI, a senior crypto news editor. Write a clear, neutral, " +
    "well-structured briefing so a reader understands the whole story WITHOUT " +
    "leaving the site. Use light markdown EXACTLY in this shape:\n\n" +
    "**TL;DR:** one crisp sentence.\n\n" +
    "## Key points\n- 3 to 5 short bullet points with the concrete facts, names and numbers.\n\n" +
    "## Context\nOne short paragraph of background a newcomer needs.\n\n" +
    "## Why it matters\nOne short paragraph on the significance for the market.\n\n" +
    "Rules: base it ONLY on the headline and excerpt below (do not invent facts); " +
    "plain English; no hype; NO buy/sell or price calls; explicitly NOT financial advice.\n\n" +
    `Headline: ${title}\n` +
    (summary ? `Excerpt: ${summary}\n` : "")
  );
}

/**
 * A short, neutral "AI take" on a DeFi protocol (perp DEX / DEX / fee protocol)
 * for its detail page — grounded in the live numbers passed in. Education only.
 */
export function buildProtocolBriefPrompt(input: {
  name: string;
  kind: string; // "perp DEX" | "DEX" | "fee protocol"
  metric: string; // "volume" | "fees"
  total24h: number;
  total7d: number;
  change7d: number;
  chains: string[];
}): string {
  const facts = [
    `Protocol: ${input.name} (${input.kind})`,
    `24h ${input.metric}: $${Math.round(input.total24h)}`,
    `7d ${input.metric}: $${Math.round(input.total7d)}`,
    `7d change: ${input.change7d.toFixed(2)}%`,
    input.chains.length ? `Chains: ${input.chains.slice(0, 6).join(", ")}` : "",
  ].filter(Boolean).join("\n");
  return (
    "You are XYZ AI, a crypto analyst. In 3 short sentences give a neutral, " +
    "educational take on this DeFi protocol using ONLY the live numbers below: " +
    "what it is in one line, and what its activity + trend suggest. Plain English, " +
    "no hype, NO buy/sell or investment calls, explicitly NOT financial advice.\n\n" +
    facts
  );
}

/**
 * A short, neutral "AI take" on a coin for its detail page — grounded in the
 * live numbers passed in. Education only, never financial advice.
 */
export function buildCoinBriefPrompt(input: {
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  change7d: number;
  rank: number | null;
  marketCap: number;
}): string {
  const facts = [
    `Coin: ${input.name} (${input.symbol})`,
    input.rank ? `Market-cap rank: #${input.rank}` : "",
    `Price: $${input.price}`,
    `24h change: ${input.change24h.toFixed(2)}%`,
    `7d change: ${input.change7d.toFixed(2)}%`,
    `Market cap: $${Math.round(input.marketCap)}`,
  ].filter(Boolean).join("\n");
  return (
    "You are XYZ AI, a crypto analyst. In 3 short sentences give a neutral, " +
    "educational take on this coin using ONLY the live numbers below: what it is " +
    "in one line, and what its market position + recent price action suggest. " +
    "Plain English, no hype, NO buy/sell calls, explicitly NOT financial advice.\n\n" +
    facts
  );
}

/**
 * Fuller on-site digest so a reader gets the whole story WITHOUT leaving the
 * site — what happened, key names/numbers, and why it matters, in a few
 * sentences. Used by the News hub's "AI Summary" action.
 */
export function buildNewsDigestPrompt(title: string, summary: string): string {
  return (
    "You are XYZ AI, a crypto news editor. Summarize this story in 3–4 clear " +
    "sentences so a reader gets the full picture WITHOUT opening the original " +
    "article: what happened, the key names/numbers, and why it matters. Plain " +
    "English, neutral, no hype, no preamble, not financial advice.\n\n" +
    `Headline: ${title}\n` +
    (summary ? `Details: ${cleanSummary(summary).slice(0, 800)}\n` : "")
  );
}
