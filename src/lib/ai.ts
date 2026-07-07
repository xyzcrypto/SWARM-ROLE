// XYZ AI — back-compat facade over the multi-provider gateway (src/lib/ai/*).
// Server-only. The rest of the app keeps calling `streamAssistant` / `completeText`
// exactly as before; provider selection, timeouts, retries and fallback all happen
// inside the gateway. Keys are read only in the provider modules, never here and
// never client-side.
//
// Graceful degradation (house rule): when no provider is configured, `aiEnabled`
// is false and every helper returns null so callers no-op cleanly.
import { aiEnabled } from "@/lib/env";
import { runStream, runComplete, AiCapacityError, type GatewayCtx } from "@/lib/ai/gateway";
import type { AiTask } from "@/lib/ai/providers/types";

export { aiEnabled };
export type AiMessage = { role: "user" | "assistant"; content: string };
export type { GatewayCtx } from "@/lib/ai/gateway";

/**
 * Map any AI error to a short, user-facing reason so the UI can explain WHY a
 * request failed (usage limit vs misconfigured vs blocked) instead of a generic
 * "try again" — also makes the cause diagnosable from a screenshot.
 */
export function aiErrorMessage(err: unknown): string {
  if (err instanceof AiCapacityError) {
    return err.reason === "no_provider"
      ? "XYZ AI isn't configured right now. Please check back soon."
      : "XYZ AI is busy at the moment. Please try again in a little while.";
  }
  const s = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (/(429|resource_exhausted|quota|rate.?limit|too many requests)/.test(s))
    return "XYZ AI has hit its usage limit for now. Please try again in a little while.";
  if (/(api.?key|401|403|permission.?denied|unauthenticated|unauthorized|invalid.*key)/.test(s))
    return "XYZ AI isn't configured correctly right now. Please check back soon.";
  if (/(safety|blocked|content.?filter|flagged|recitation)/.test(s))
    return "XYZ AI couldn't answer that one. Try rephrasing your question.";
  return "XYZ AI ran into an issue finishing that answer. Please try again.";
}

/**
 * Start a streamed assistant completion. Returns an async iterable of **text
 * deltas** (plain strings) — or null when AI is disabled. The provider chain and
 * fallback are resolved lazily on first iteration, so a thrown error reaches the
 * caller's in-stream error path (same contract as before).
 */
export function streamAssistant(opts: {
  system: string;
  messages: AiMessage[];
  maxTokens?: number;
  ctx?: GatewayCtx;
}): AsyncIterable<string> | null {
  if (!aiEnabled) return null;
  async function* run() {
    const handle = await runStream(
      "assistant",
      { system: opts.system, messages: opts.messages, maxTokens: opts.maxTokens ?? 1500 },
      opts.ctx ?? {}
    );
    yield* handle.stream;
  }
  return run();
}

/**
 * One-shot text completion for bulk/cheap tasks (summaries, moderation, news
 * digests). Returns the response text, or null on disable/empty. Throws on a
 * genuine failure (all providers down) so the caller can swallow it (best-effort)
 * or surface it via handleError.
 */
export async function completeText(opts: {
  task?: AiTask;
  system?: string;
  prompt: string;
  maxTokens?: number;
  ctx?: GatewayCtx;
}): Promise<string | null> {
  if (!aiEnabled) return null;
  const res = await runComplete(
    opts.task ?? "summary",
    { system: opts.system, prompt: opts.prompt, maxTokens: opts.maxTokens ?? 300 },
    opts.ctx ?? {}
  );
  return res.text?.trim() || null;
}
