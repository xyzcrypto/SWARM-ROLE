// Pull the research articles an assistant answer actually cited, so the panel
// can show them as a compact source row.
//
// No prompt change is needed for this: `buildAssistantSystemPrompt` already
// instructs the model to cite as [Title](/research/slug), and `buildCorpus`
// hands it the slug for every article in the grounding corpus. This just reads
// back what the model already emits, which is why showing sources costs no
// extra tokens.
//
// Client-safe on purpose (no server imports) - the widget imports it directly.

export type AiSource = { title: string; slug: string; href: string };

// [Title](/research/slug). Titles cannot contain ']' and slugs are the
// lowercase-hyphen form the corpus emits; anything else is not a citation.
const CITATION = /\[([^\]\n]+)\]\((\/research\/[a-z0-9][a-z0-9-]*)\)/gi;

/**
 * Extract cited research articles from an answer, in first-appearance order,
 * de-duplicated by slug. Returns [] for anything uncited - the caller should
 * render no source row at all rather than an empty one.
 */
export function extractSources(markdown: string): AiSource[] {
  if (!markdown) return [];
  const out: AiSource[] = [];
  const seen = new Set<string>();
  for (const m of markdown.matchAll(CITATION)) {
    const title = m[1].trim();
    const href = m[2];
    const slug = href.slice("/research/".length);
    if (!title || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ title, slug, href });
  }
  return out;
}
