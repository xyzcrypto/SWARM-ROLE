/**
 * @mention parsing, shared by every surface that has to agree on what a mention
 * is: the community room's renderer and autocomplete, the DM renderer, and the
 * server that turns one into a notification.
 *
 * It lived as a regex literal inline in `ChatClient.tsx` and nowhere else, which
 * is why the three of them did not agree. DM had no notion of mentions at all -
 * typing `@alice` there rendered as grey text - and nothing anywhere turned a
 * mention into a notification, so being tagged was something you found out
 * about by scrolling.
 *
 * The pattern matches the handle rules in `profile.ts` (3-20 of `[a-z0-9_]`,
 * case-insensitive on input because people type `@Alice`). Kept as ONE
 * definition so the thing that highlights a mention and the thing that notifies
 * on it can never drift into disagreeing about which words are mentions.
 */

/** A mention, as typed. Global + case-insensitive; `\b` would not do - it
 *  treats `@` as a boundary and would match the `alice` inside `email@alice`. */
export const MENTION_RE = /(^|[^a-zA-Z0-9_@/])@([a-zA-Z0-9_]{3,20})/g;

/** The same shape, anchored, for testing a single already-split token. */
export const MENTION_TOKEN_RE = /^@([a-zA-Z0-9_]{3,20})$/;

/** Split text into parts, keeping mentions and urls as their own pieces. */
export const MENTION_SPLIT_RE = /(https?:\/\/\S+|@[a-zA-Z0-9_]{3,20})/g;

/**
 * Every distinct handle mentioned in `text`, lowercased.
 *
 * Lowercased because handles are stored lowercased (`normalizeUsername`), so
 * `@Alice` and `@alice` are the same person and must not notify twice.
 *
 * Capped: a message is a message, not a broadcast list. Without a cap, one
 * message pasting fifty handles would fan out to fifty notification rows and
 * fifty pushes - which is the shape of a spam tool, not a chat feature.
 */
export const MAX_MENTIONS_PER_MESSAGE = 5;

export function extractMentions(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  // `matchAll` on a /g regex, so the lastIndex bookkeeping is not ours to get
  // wrong - a shared mutable /g regex used with `.test()` is a classic source
  // of every-other-call failures.
  for (const m of text.matchAll(MENTION_RE)) {
    const handle = m[2]?.toLowerCase();
    if (!handle || seen.has(handle)) continue;
    seen.add(handle);
    out.push(handle);
    if (out.length >= MAX_MENTIONS_PER_MESSAGE) break;
  }
  return out;
}
