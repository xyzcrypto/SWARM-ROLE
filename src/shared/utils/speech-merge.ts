/**
 * Turning SpeechRecognition results into text WITHOUT doubling or dropping
 * words - pure, so every engine's quirks can be unit-tested with scripted
 * event sequences.
 *
 * ## Why positions cannot be trusted
 *
 * The previous version counted how many entries of `e.results` it had already
 * delivered and emitted everything after that index. That is correct for
 * desktop Chrome, where `results` is a cumulative list of separate utterances.
 * It is wrong for Chrome on Android, which does two other things:
 *
 *  1. **Repeats the phrase so far as a new final result** - results become
 *     ["hello", "hello world"], so emitting the new entry printed
 *     "hello hello world". That is the "double word" report.
 *  2. **Restarts the list** - a new event arrives with `results.length === 1`
 *     holding the next phrase at index 0. An index cursor already past 0 then
 *     skips it entirely: words that were clearly spoken never appear. That is
 *     the "sahi se detect nahi karta" report.
 *
 * So the unit of truth is TEXT, not position: work out the session's final
 * transcript from whatever the engine sent, then emit only the words that were
 * not already delivered.
 */

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

/** Does `a` start with all of `b`? (word-wise, case/punctuation-insensitive) */
function startsWithWords(a: string[], b: string[]): boolean {
  if (b.length > a.length) return false;
  return b.every((w, i) => norm(w) === norm(a[i]!));
}

/** Largest k such that the last k words of `a` equal the first k words of `b`. */
function overlap(a: string[], b: string[]): number {
  for (let k = Math.min(a.length, b.length); k > 0; k--) {
    let same = true;
    for (let i = 0; i < k; i++) {
      if (norm(a[a.length - k + i]!) !== norm(b[i]!)) { same = false; break; }
    }
    if (same) return k;
  }
  return 0;
}

/**
 * The session's final transcript from the final results of one event, with
 * Android's "phrase so far" repeats collapsed rather than appended.
 */
export function collapseFinals(chunks: string[]): string {
  let acc: string[] = [];
  for (const c of chunks) {
    const w = words(c);
    if (!w.length) continue;
    if (startsWithWords(w, acc)) acc = w; // "hello" then "hello world": the longer one replaces
    else if (startsWithWords(acc, w)) continue; // a shorter repeat of what we already have
    else acc = acc.concat(w.slice(overlap(acc, w))); // a genuinely new utterance
  }
  return acc.join(" ");
}

/**
 * The words in `session` that have not been delivered yet.
 *
 * Normally `session` extends `delivered` and the answer is the tail. When the
 * engine restarted its list, `session` is just the newest phrase; then only
 * the part that does not overlap the end of what was delivered is new.
 */
export function newWords(delivered: string, session: string): string {
  const d = words(delivered);
  const s = words(session);
  if (!s.length) return "";
  if (startsWithWords(s, d)) return s.slice(d.length).join(" ");
  if (startsWithWords(d, s)) return ""; // an older, shorter view of what we already sent
  return s.slice(overlap(d, s)).join(" ");
}

/** Append `next` to `delivered` as the running record of what has been emitted. */
export function appendWords(delivered: string, next: string): string {
  return [delivered.trim(), next.trim()].filter(Boolean).join(" ");
}
