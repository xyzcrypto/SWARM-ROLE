// XYZ AI — the single Anthropic (Claude) client wrapper. Server-only: this module
// reads ANTHROPIC_API_KEY and must never be imported into a client component.
//
// Graceful degradation (house rule): when the key is unset, `aiEnabled` is false
// and every helper here returns null so callers can no-op cleanly — the site is
// never broken by missing AI config (same pattern as email/storage/realtime).
import Anthropic from "@anthropic-ai/sdk";
import { env, aiEnabled } from "@/lib/env";

export { aiEnabled };

// Model choice (see plan): the assistant uses the flagship for best answers;
// high-volume bulk work (summaries, chat moderation) uses the cheap fast model.
export const AI_MODEL_ASSISTANT = "claude-opus-4-8";
export const AI_MODEL_FAST = "claude-haiku-4-5";

// One lazily-constructed client per server instance.
let _client: Anthropic | null = null;
export function getAiClient(): Anthropic | null {
  if (!aiEnabled) return null;
  if (!_client) _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return _client;
}

export type AiMessage = { role: "user" | "assistant"; content: string };

/**
 * Start a streamed assistant completion. Returns the SDK MessageStream (iterate
 * it or `.on("text", …)`), or null when AI is disabled. Callers own the
 * try/catch so a thrown API error reaches their handleError. Uses adaptive
 * thinking + streaming per the Claude API guidance.
 */
export function streamAssistant(opts: {
  system: string;
  messages: AiMessage[];
  maxTokens?: number;
}) {
  const client = getAiClient();
  if (!client) return null;
  return client.messages.stream({
    model: AI_MODEL_ASSISTANT,
    max_tokens: opts.maxTokens ?? 1500,
    thinking: { type: "adaptive" },
    system: opts.system,
    messages: opts.messages,
  });
}

/**
 * One-shot text completion for bulk/cheap tasks (summaries, moderation). Returns
 * the concatenated text of the first response, or null on disable/empty. Throws
 * on API error so the caller can decide whether to swallow it (best-effort) or
 * surface it via handleError.
 */
export async function completeText(opts: {
  model?: string;
  system?: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string | null> {
  const client = getAiClient();
  if (!client) return null;
  const res = await client.messages.create({
    model: opts.model ?? AI_MODEL_FAST,
    max_tokens: opts.maxTokens ?? 300,
    ...(opts.system ? { system: opts.system } : {}),
    messages: [{ role: "user", content: opts.prompt }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return text || null;
}
