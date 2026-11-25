import "server-only";
import { env } from "@/lib/env";

/**
 * AneQue's voice for text that has no studio recording (new or admin-edited
 * questions, Live Talk answers, names outside the name bank).
 *
 * ⚠️ This replaces the device's speechSynthesis voice, which is what learners
 * heard as the "cheap web voice". Providers are tried in order; a provider
 * without a key is skipped, and a model id that was retired falls through to
 * the next candidate, so a rename upstream degrades to the next voice rather
 * than to silence. Everything returns 16-bit mono WAV.
 */
type Lang = "en" | "hi";
type Render = { audio: Uint8Array; provider: string };

const STYLE: Record<Lang, string> = {
  en: "Say warmly and clearly, like a friendly teacher:",
  hi: "Say warmly and clearly in natural Hinglish with a soft Indian accent:",
};

function wav(pcm: Uint8Array, rate = 24000): Uint8Array {
  const h = new DataView(new ArrayBuffer(44));
  const w = (o: number, s: string) => [...s].forEach((c, i) => h.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); h.setUint32(4, 36 + pcm.length, true); w(8, "WAVE"); w(12, "fmt ");
  h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 1, true); h.setUint32(24, rate, true);
  h.setUint32(28, rate * 2, true); h.setUint16(32, 2, true); h.setUint16(34, 16, true); w(36, "data"); h.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length); out.set(new Uint8Array(h.buffer), 0); out.set(pcm, 44);
  return out;
}

const GEMINI_MODELS = ["gemini-2.5-flash-preview-tts", "gemini-2.5-flash-tts", "gemini-2.5-pro-preview-tts"];
const GEMINI_VOICE = "Kore";
async function gemini(text: string, lang: Lang, signal: AbortSignal): Promise<Render | null> {
  if (!env.GEMINI_API_KEY) return null;
  for (const model of GEMINI_MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${STYLE[lang]} ${text}` }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_VOICE } } } },
      }),
    }).catch(() => null);
    if (!r) continue;
    if (r.status === 404 || r.status === 400) continue; // retired or unknown model: try the next
    if (!r.ok) return null;
    const j = (await r.json().catch(() => null)) as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] } | null;
    const part = j?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    if (!part?.data) continue;
    const rate = Number(/rate=(\d+)/.exec(part.mimeType ?? "")?.[1]) || 24000;
    return { audio: wav(Buffer.from(part.data, "base64"), rate), provider: `gemini:${model}` };
  }
  return null;
}

const GROQ_CANDIDATES: [string, string][] = [
  ["canopylabs/orpheus-v1-english", "diana"],
  ["canopylabs/orpheus-v1-english", "tara"],
  ["playai-tts", "Celeste-PlayAI"],
];
async function groq(text: string, _lang: Lang, signal: AbortSignal): Promise<Render | null> {
  if (!env.GROQ_API_KEY) return null;
  for (const [model, voice] of GROQ_CANDIDATES) {
    const r = await fetch("https://api.groq.com/openai/v1/audio/speech", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: JSON.stringify({ model, voice, input: text, response_format: "wav" }),
    }).catch(() => null);
    if (!r) continue;
    if (!r.ok) continue; // unknown model/voice or terms not accepted: next candidate
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length > 1000) return { audio: buf, provider: `groq:${model}:${voice}` };
  }
  return null;
}

const PROVIDERS = { gemini, groq } as const;

export function neuralVoiceEnabled() {
  return !!(env.GEMINI_API_KEY || env.GROQ_API_KEY);
}

/** Render `text` in AneQue's neural voice, or null when no provider could. */
export async function renderNeural(text: string, lang: Lang): Promise<Render | null> {
  const order = (env.ACADEMY_TTS_ORDER || "gemini,groq").split(",").map((s) => s.trim()) as (keyof typeof PROVIDERS)[];
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20_000);
  try {
    for (const name of order) {
      const p = PROVIDERS[name];
      if (!p) continue;
      const r = await p(text, lang, ctl.signal).catch(() => null);
      if (r) return r;
    }
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Pure, for tests: the text the route accepts (trimmed, collapsed, capped). */
export function cleanVoiceText(raw: string | null): string {
  return (raw ?? "").replace(/\s+/g, " ").trim().slice(0, 420);
}
