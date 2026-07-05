// XYZ AI — the single AI provider wrapper. Server-only: reads GEMINI_API_KEY and
// must never be imported into a client component.
//
// Provider: Google Gemini (free tier) for now. The whole app talks to AI *only*
// through this file — route, widget, grounding and rate-limits are all
// provider-agnostic — so switching to Claude (or anything else) later means
// editing just this module.
//
// Graceful degradation (house rule): when the key is unset, `aiEnabled` is false
// and every helper returns null so callers no-op cleanly (same pattern as
// email/storage/realtime). The site is never broken by missing AI config.
import { GoogleGenAI } from "@google/genai";
import { env, aiEnabled } from "@/lib/env";

export { aiEnabled };

// Model choice: Gemini's free-tier fast model for the assistant; the lite variant
// is reserved for PR 2's high-volume bulk work (summaries, chat moderation).
export const AI_MODEL_ASSISTANT = "gemini-2.5-flash";
export const AI_MODEL_FAST = "gemini-2.5-flash-lite";

// One lazily-constructed client per server instance.
let _client: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  if (!aiEnabled) return null;
  if (!_client) _client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return _client;
}

export type AiMessage = { role: "user" | "assistant"; content: string };

// Map our neutral {user|assistant} history to Gemini's contents shape
// (Gemini uses the role name "model" for assistant turns).
function toContents(messages: AiMessage[]) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

/**
 * Start a streamed assistant completion. Returns an async iterable of **text
 * deltas** (plain strings) so the route stays fully provider-agnostic — or null
 * when AI is disabled. Callers own the try/catch so a thrown API error reaches
 * their handleError / in-stream error path.
 */
export function streamAssistant(opts: {
  system: string;
  messages: AiMessage[];
  maxTokens?: number;
}): AsyncIterable<string> | null {
  const client = getAiClient();
  if (!client) return null;
  async function* run() {
    const stream = await client!.models.generateContentStream({
      model: AI_MODEL_ASSISTANT,
      contents: toContents(opts.messages),
      config: {
        systemInstruction: opts.system,
        maxOutputTokens: opts.maxTokens ?? 1500,
      },
    });
    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) yield text;
    }
  }
  return run();
}

/**
 * One-shot text completion for bulk/cheap tasks (summaries, moderation in PR 2).
 * Returns the response text, or null on disable/empty. Throws on API error so the
 * caller can decide to swallow it (best-effort) or surface it via handleError.
 */
export async function completeText(opts: {
  model?: string;
  system?: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string | null> {
  const client = getAiClient();
  if (!client) return null;
  const res = await client.models.generateContent({
    model: opts.model ?? AI_MODEL_FAST,
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    config: {
      ...(opts.system ? { systemInstruction: opts.system } : {}),
      maxOutputTokens: opts.maxTokens ?? 300,
    },
  });
  const text = res.text?.trim();
  return text || null;
}
