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
