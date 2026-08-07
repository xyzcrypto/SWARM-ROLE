// Pure helpers for the browser text-to-speech controls (see BriefingBlock).
// Kept framework-free so they can be unit-tested without the Web Speech API.

export type VoiceLike = { name: string; lang: string };

/**
 * Pick the best available voice for an ordered list of preferred BCP-47 langs.
 * Within the first language that has any match, prefer a high-quality named
 * engine (Google / Natural / Neural / Microsoft / etc.) over the first match.
 * Returns null when nothing matches (caller falls back to the browser default).
 */
export function pickVoice<T extends VoiceLike>(voices: T[], langs: string[]): T | null {
  for (const l of langs) {
    const ll = l.toLowerCase();
    const matches = voices.filter((v) => {
      const vl = (v.lang || "").toLowerCase();
      return vl === ll || vl.startsWith(ll);
    });
    if (!matches.length) continue;
    const nice = matches.find((v) => /google|natural|neural|enhanced|premium|siri|microsoft/i.test(v.name || ""));
    return nice || matches[0];
  }
  return null;
}

// Playback speeds the "speed" toggle cycles through (starts at 1x).
export const TTS_RATES = [1, 1.25, 1.5, 0.75] as const;

/** The next speed in the cycle (wraps around). Unknown rates restart at 1x. */
export function nextRate(rate: number): number {
  const i = (TTS_RATES as readonly number[]).indexOf(rate);
  return TTS_RATES[(i + 1) % TTS_RATES.length];
}

/**
 * Split text into utterance-sized chunks on sentence boundaries.
 *
 * Long single utterances are the reason "Listen" failed on so many devices:
 * Chrome (desktop and Android) silently stops speaking after roughly 15
 * seconds, and several Android engines refuse a very long string outright. In
 * both cases the button flips back with no error and nothing is spoken past the
 * cut. Speaking a queue of short utterances avoids the limit entirely, because
 * each one restarts the timer.
 *
 * Splits on sentence ends first; a sentence longer than `max` on its own is
 * broken at the last space before the limit rather than mid-word.
 */
export function chunkForSpeech(text: string, max = 180): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= max) return [clean];

  // Keep the terminator with its sentence.
  const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [clean];
  const out: string[] = [];
  let buf = "";

  const flushLong = (s: string) => {
    let rest = s;
    while (rest.length > max) {
      const cut = rest.lastIndexOf(" ", max);
      const at = cut > max * 0.5 ? cut : max; // never chop a word in half unless forced
      out.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    return rest;
  };

  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    if (s.length > max) {
      if (buf) { out.push(buf); buf = ""; }
      const tail = flushLong(s);
      if (tail) buf = tail;
      continue;
    }
    if (!buf) buf = s;
    else if (buf.length + 1 + s.length <= max) buf += " " + s;
    else { out.push(buf); buf = s; }
  }
  if (buf) out.push(buf);
  return out;
}
