// XYZ AI — the single AI provider wrapper. Server-only: reads GROQ_API_KEY and
// must never be imported into a client component.
//
// Provider: Groq (free tier, Llama models) — chosen for its generous free limits
// and very fast inference. The whole app talks to AI *only* through this file —
// route, widget, grounding and rate-limits are all provider-agnostic — so
// switching providers later means editing just this module.
//
// Graceful degradation (house rule): when the key is unset, `aiEnabled` is false
// and every helper returns null so callers no-op cleanly (same pattern as
// email/storage/realtime). The site is never broken by missing AI config.
import Groq from "groq-sdk";
import { env, aiEnabled } from "@/lib/env";

export { aiEnabled };

// Model choice: a strong 70B for the assistant; a fast small model for the
// high-volume bulk work (article summaries, chat moderation).
export const AI_MODEL_ASSISTANT = "llama-3.3-70b-versatile";
export const AI_MODEL_FAST = "llama-3.1-8b-instant";

// One lazily-constructed client per server instance.
let _client: Groq | null = null;
function getAiClient(): Groq | null {
  if (!aiEnabled) return null;
  if (!_client) _client = new Groq({ apiKey: env.GROQ_API_KEY });
  return _client;
}

export type AiMessage = { role: "user" | "assistant"; content: string };

/**
 * Map a provider error to a short, user-facing reason. Lets the assistant show
 * WHY it failed (usage limit vs misconfigured key vs blocked) instead of a
 * generic "try again", which also makes the cause diagnosable from a screenshot.
 */
export function aiErrorMessage(err: unknown): string {
  const s = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (/(429|resource_exhausted|quota|rate.?limit|too many requests)/.test(s))
    return "XYZ AI has hit its usage limit for now. Please try again in a little while.";
  if (/(api.?key|401|403|permission.?denied|unauthenticated|unauthorized|invalid.*key)/.test(s))
    return "XYZ AI isn't configured correctly right now. Please check back soon.";
  if (/(safety|blocked|content.?filter|flagged)/.test(s))
    return "XYZ AI couldn't answer that one. Try rephrasing your question.";
  return "XYZ AI ran into an issue finishing that answer. Please try again.";
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
    const stream = await client!.chat.completions.create({
      model: AI_MODEL_ASSISTANT,
      max_tokens: opts.maxTokens ?? 1500,
      stream: true,
      messages: [
        { role: "system", content: opts.system },
        ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) yield text;
    }
  }
  return run();
}

/**
 * One-shot text completion for bulk/cheap tasks (summaries, moderation). Returns
 * the response text, or null on disable/empty. Throws on API error so the caller
 * can decide to swallow it (best-effort) or surface it via handleError.
 */
export async function completeText(opts: {
  model?: string;
  system?: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string | null> {
  const client = getAiClient();
  if (!client) return null;
  const res = await client.chat.completions.create({
    model: opts.model ?? AI_MODEL_FAST,
    max_tokens: opts.maxTokens ?? 300,
    messages: [
      ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
      { role: "user" as const, content: opts.prompt },
    ],
  });
  const text = res.choices[0]?.message?.content?.trim();
  return text || null;
}
