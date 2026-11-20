import "server-only";
import { createHash } from "node:crypto";
import manifest from "../content/voice-manifest.json";

// Nova's recorded clips for lesson and quiz text. Every prompt, option,
// explanation and lesson summary of the starter curriculum was rendered once
// offline in Nova's voice and named by a hash of its exact text, so an admin
// edit simply has no clip (the browser voice reads it instead) rather than
// playing a recording of the old wording.

const have = new Set<string>(manifest as string[]);

export const textHash = (t: string) => createHash("sha1").update(t.trim()).digest("hex").slice(0, 16);

/** URL of Nova's recording of exactly this text, or null. */
export function clip(text: string | null | undefined): string | null {
  if (!text) return null;
  const h = textHash(text);
  return have.has(h) ? `/academy/voice/c/${h}.mp3` : null;
}
