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
