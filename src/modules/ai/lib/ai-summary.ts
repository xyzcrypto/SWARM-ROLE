// XYZ AI - pure prompt builders + output parsers for the article-summary and
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
    'no "This article", no markdown - just the summary sentence(s).\n\n' +
    `Title: ${title}\n\nArticle:\n${body}`
  );
}

/** Tidy a model summary: strip wrapping quotes / a leading "TL;DR:" label / caps. */
export function cleanSummary(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^["'`]+|["'`]+$/g, "").trim();
  s = s.replace(/^(tl;?\s*dr|summary)\s*[:\-–-]\s*/i, "").trim();
  return s.slice(0, MAX_SUMMARY_OUTPUT).trim();
}

/**
 * Prompt for chat auto-moderation. The model must answer with a single word so
 * parsing is trivial; it's told to default to SAFE when unsure (conservative -
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
    "matters for the crypto market and who it affects - practical and plain, no hype, " +
    "no preamble, not financial advice.\n\n" +
    `Headline: ${title}\n` +
    (summary ? `Summary: ${cleanSummary(summary).slice(0, 500)}\n` : "")
  );
}

/**
 * A full, article-length on-site briefing so a reader gets the WHOLE story
 * without leaving the site - an editor's explainer, not a blurb. Light markdown
 * with several sections + bullets. Neutral, education-only, never financial advice.
 */
export function buildNewsBriefingPrompt(title: string, summary: string): string {
  return (
    "You are XYZ AI, a senior crypto news editor writing a deep, complete briefing so the reader " +
    "fully understands the story WITHOUT leaving the site - an in-depth explainer, not a blurb " +
    "(~650-900 words). Substantive, neutral, and genuinely informative: explain not just what happened " +
    "but who is involved, why it works the way it does, and what it means. Use light markdown EXACTLY " +
    "in this shape:\n\n" +
    "**TL;DR:** one crisp sentence that captures the whole story.\n\n" +
    "## What happened\nTwo tight paragraphs in plain English - the who, what, when and where, with the concrete facts, names and numbers.\n\n" +
    "## Key details\n- 5 to 7 bullet points with the specifics that matter (mechanics, terms, scope).\n\n" +
    "## Key numbers\n- The most important figures/metrics involved (prices, %, amounts, dates, sizes). If the excerpt has none, say what figures to look for instead of inventing any.\n\n" +
    "## Key players\n- 2 to 4 bullets naming the people, companies, chains or protocols involved and what each stands to gain or lose. Only those actually implied by the story.\n\n" +
    "## Background\nOne short paragraph of context and how we got here - what a newcomer needs to make sense of it.\n\n" +
    "## Why it matters\nOne short paragraph on the significance for the wider market/ecosystem and who is affected.\n\n" +
    "## Different angles\n- 3 to 4 bullets giving balanced perspectives - bull case vs bear case, supporters vs skeptics, optimistic vs cautious reads - without taking sides.\n\n" +
    "## Jargon buster\n- 2 to 3 of the crypto terms in this story, each defined in one plain-English line for a newcomer. Skip this section only if the story has no jargon.\n\n" +
    "## What to watch next\n- Two or three bullets on what could happen next, the key dates/triggers, and what to keep an eye on.\n\n" +
    "Rules: base it ONLY on the headline and excerpt below - reason generally where the excerpt is thin, " +
    "but NEVER fabricate specific facts, quotes, names or numbers you weren't given (say what's unknown instead); " +
    "plain English, no hype, no filler; NO buy/sell or price predictions; explicitly NOT financial advice.\n\n" +
    `Headline: ${title}\n` +
    (summary ? `Excerpt: ${summary}\n` : "")
  );
}

/**
 * A briefing over SEVERAL headlines, not one story.
 *
 * ⚠️ This exists because the points band was feeding a list of headlines into
 * `buildNewsBriefingPrompt`, which is written for ONE story: it asks for "What
 * happened", "Key players", "Background" and a TL;DR that "captures the whole
 * story". Handed eight unrelated items as an "excerpt", a model either picks one
 * and ignores the rest or writes something short and hedged - which is exactly
 * what a reader reported, repeatedly, as the briefing "not working".
 *
 * The shape of the answer has to match the shape of the input. A roundup's job
 * is to find the THREAD across items, not to pretend they are one event.
 */
export function buildPointsRoundupPrompt(headlines: string): string {
  return (
    "You are XYZ AI, briefing an experienced perp DEX points farmer on today's news. " +
    "You are given SEVERAL separate stories, not one. Do not treat them as a single event, and do not " +
    "invent a connection that is not there - if they are unrelated, say so and cover them separately. " +
    "Aim for 400-600 words. Use light markdown EXACTLY in this shape:\n\n" +
    "**TL;DR:** one or two sentences on what actually matters across all of it.\n\n" +
    "## What changed\n- One bullet per story that matters, each naming the venue or protocol and the " +
    "concrete change. Skip anything that is noise; a shorter honest list beats a padded one.\n\n" +
    "## What it means for farmers\nOne short paragraph: who should do something differently, and what. " +
    "If the honest answer is 'nothing yet', say that.\n\n" +
    "## Dates to watch\n- Any snapshot, TGE, season end or deadline named in the stories, with the venue. " +
    "If none are given, write 'None stated in these stories' rather than guessing one.\n\n" +
    "## What is still unknown\n- Two or three bullets on what these stories do NOT tell you and would " +
    "change the picture.\n\n" +
    "Rules: base it ONLY on the items below; NEVER invent figures, dates, names or quotes you were not " +
    "given; plain English, no hype; NO buy/sell or price predictions; explicitly not financial advice.\n\n" +
    `Stories:\n${headlines}\n`
  );
}

/**
 * Translate a finished English briefing into natural Hinglish (Hindi written in
 * Roman/Latin script, mixed with common English crypto terms) - the way a bilingual
 * Indian creator would explain it. Preserves the markdown structure + headings.
 */
export function buildHinglishPrompt(text: string): string {
  return (
    "Rewrite the following crypto news briefing in natural HINGLISH - Hindi written " +
    "in Roman (Latin) script, casually mixed with the usual English crypto terms " +
    "(Bitcoin, ETF, market, price, etc.), the way a friendly bilingual Indian creator " +
    "would explain it to a friend. Keep the SAME markdown structure and section " +
    "headings (translate the heading text to Hinglish too). Keep it clear and neutral, " +
    "do NOT add new facts, and keep any 'not financial advice' note. Output only the " +
    "rewritten briefing.\n\n" +
    text
  );
}

/**
 * A short, neutral "AI take" on a DeFi protocol (perp DEX / DEX / fee protocol)
 * for its detail page - grounded in the live numbers passed in. Education only.
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
 * A short, neutral "AI take" on a coin for its detail page - grounded in the
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
 * site - what happened, key names/numbers, and why it matters, in a few
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
