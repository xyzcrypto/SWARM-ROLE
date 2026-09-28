import "server-only";
import Groq, { toFile } from "groq-sdk";
import { env, groqEnabled } from "@/lib/env";

/**
 * Speech-to-text for voice messages, via Groq's hosted Whisper (the same Groq
 * key the XYZ AI assistant already uses). Whisper handles Hindi, English and
 * mixed Hinglish speech, and detects the language itself.
 *
 * `whisper-large-v3-turbo` first (fast, cheap), `whisper-large-v3` if the
 * account does not have turbo. Any failure returns null; the caller turns that
 * into an honest "not available" rather than an error page.
 */
export const transcribeEnabled = groqEnabled;

const MODELS = ["whisper-large-v3-turbo", "whisper-large-v3"] as const;

let _client: Groq | null = null;
const client = () => (_client ??= new Groq({ apiKey: env.GROQ_API_KEY }));

export async function transcribeAudio(bytes: ArrayBuffer, mime: string): Promise<string | null> {
  if (!transcribeEnabled) return null;
  const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
  for (const model of MODELS) {
    try {
      const file = await toFile(Buffer.from(bytes), `voice.${ext}`, { type: mime });
      const res = await client().audio.transcriptions.create({ file, model, response_format: "json", temperature: 0 });
      const text = (res as { text?: string }).text?.trim() ?? "";
      if (text) return text;
      return "";
    } catch (err) {
      console.error(`[transcribe] ${model} failed`, (err as Error)?.message ?? err);
    }
  }
  return null;
}
