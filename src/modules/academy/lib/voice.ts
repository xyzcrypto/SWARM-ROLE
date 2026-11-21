import "server-only";
import { createHash } from "node:crypto";
import manifest from "../content/voice-manifest.json";
import hinglishMap from "../content/hinglish.json";
import hiManifest from "../content/voice-manifest-hi.json";

// AneQue's recorded clips for lesson and quiz text. Every prompt, option,
// explanation and lesson summary of the starter curriculum was rendered once
// offline in AneQue's voice and named by a hash of its exact text, so an admin
// edit simply has no clip (the browser voice reads it instead) rather than
// playing a recording of the old wording.

const have = new Set<string>(manifest as string[]);

export const textHash = (t: string) => createHash("sha1").update(t.trim()).digest("hex").slice(0, 16);

/** URL of AneQue's recording of exactly this text, or null. */
export function clip(text: string | null | undefined): string | null {
  if (!text) return null;
  const h = textHash(text);
  return have.has(h) ? `/academy/voice/c/${h}.mp3` : null;
}

// Hinglish: every lesson and quiz string translated (roman Hinglish for the
// screen), keyed by the same hash as the English clip, and rendered in
// AneQue's same voice from a Devanagari version so the Hindi is pronounced
// properly. Missing entries simply fall back to English.
const hi = hinglishMap as Record<string, string>;
const hiHave = new Set<string>(hiManifest as string[]);

export type HiText = { text: string; voice: string | null };

/** The Hinglish version of exactly this English text (and its recording), or null. */
export function hinglish(text: string | null | undefined): HiText | null {
  if (!text) return null;
  const h = textHash(text);
  const t = hi[h];
  if (!t) return null;
  return { text: t, voice: hiHave.has(h) ? `/academy/voice/h/${h}.mp3` : null };
}
