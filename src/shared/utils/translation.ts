// Post-processing for the chat translator, kept pure so the rules are testable
// without calling a model.
//
// The prompt tells the model to return only the converted sentence and to never
// return the same language it was given. Models comply *most* of the time. The
// two ways it fails both look like a broken feature rather than a failed call:
//
//   1. It wraps the answer - quotes, "Output:", a language label - and the chat
//      shows that punctuation as if it were part of the message.
//   2. It echoes the input unchanged, and the chat shows a "translation"
//      identical to the original, which reads as the button doing nothing.
//
// Both are caught here so the caller can say "couldn't translate" honestly
// instead of presenting a non-answer as an answer.

/** Strip the wrappers a model adds despite being told not to. */
export function cleanTranslation(raw: string): string {
  let out = raw.trim();

  // "Output:" / "Translation:" / "Hinglish:" / "English:" prefixes.
  out = out.replace(/^(output|translation|translated|hinglish|english|hindi)\s*[:\-–]\s*/i, "");

  // Surrounding quotes - straight or curly - but only when they wrap the whole
  // thing. A message that merely *contains* a quote must survive untouched.
  const pairs: [string, string][] = [
    ['"', '"'],
    ["'", "'"],
    ["“", "”"],
    ["‘", "’"],
  ];
  for (const [open, close] of pairs) {
    if (out.length > 1 && out.startsWith(open) && out.endsWith(close)) {
      out = out.slice(1, -1).trim();
      break;
    }
  }

  // A trailing parenthetical language note: "... (Hinglish)".
  out = out.replace(/\s*\((hinglish|english|hindi|translated)\)\s*$/i, "");

  return out.trim();
}

/** Loose comparison: case, punctuation and spacing don't count as a change. */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The cleaned translation, or `null` when the model gave back what it was given.
 *
 * An echo is not a translation. Returning it would show the member an identical
 * "translation" and leave them thinking the button is broken - saying we
 * couldn't do it is both true and more useful.
 */
export function translationOrNull(raw: string | null | undefined, input: string): string | null {
  if (!raw) return null;
  const cleaned = cleanTranslation(raw);
  if (!cleaned) return null;
  if (normalise(cleaned) === normalise(input)) return null;
  return cleaned;
}
