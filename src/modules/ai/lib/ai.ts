// XYZ AI - back-compat facade over the multi-provider gateway (src/lib/ai/*).
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
 * "try again" - also makes the cause diagnosable from a screenshot.
 */
function classify(err: unknown, fallback: string): string {
  const s = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (/(429|resource_exhausted|quota|rate.?limit|too many requests)/.test(s))
    return "XYZ AI has hit its usage limit for now. Please try again in a little while.";
  if (/(api.?key|401|403|permission.?denied|unauthenticated|unauthorized|invalid.*key)/.test(s))
    return "XYZ AI isn't configured correctly right now. Please check back soon.";
  if (/(safety|blocked|content.?filter|flagged|recitation)/.test(s))
    return "XYZ AI couldn't answer that one. Try rephrasing your question.";
  return fallback;
}

export function aiErrorMessage(err: unknown): string {
  if (err instanceof AiCapacityError) {
    if (err.reason === "no_provider") return "XYZ AI isn't configured right now. Please check back soon.";
    // ⚠️ `all_failed` used to stop here and return the generic "busy" line, and
    // that is why "AI is not working" was un-diagnosable.
    //
    // The gateway throws `new AiCapacityError("all_failed", { cause: lastErr })`
    // - the provider's REAL error is right there on `.cause` - and this function
    // never looked at it. So an expired key, an exhausted free quota and a
    // network outage all rendered the same sentence, the one that says nothing.
    // That is the opposite of what the docstring above promises, and the panel
    // showing "busy" for days while the actual cause was something permanent is
    // exactly the failure it was supposed to prevent.
    //
    // "Busy" stays as the fallback: when the cause genuinely is transient, or is
    // an error shape we do not recognise, it is still the honest answer.
    return classify(err.cause, "XYZ AI is busy at the moment. Please try again in a little while.");
  }
  return classify(err, "XYZ AI ran into an issue finishing that answer. Please try again.");
}

/**
 * Start a streamed assistant completion. Returns an async iterable of **text
 * deltas** (plain strings) - or null when AI is disabled. The provider chain and
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
 * A briefing, streamed.
 *
 * ⚠️ This exists because "fast" and "complete" were being traded against each
 * other, and streaming is the one change that stops them competing.
 *
 * Generated in one shot, a briefing is a single 20-40 second silence ending in
 * either a wall of text or a timeout. Every previous attempt to fix it moved
 * along that trade-off - raise `maxTokens` and it takes longer and risks the
 * function's duration cap; lower it and the answer is cut off. Four rounds of
 * that, and the reader's experience was the same each time: press a button,
 * wait, get something short or nothing at all.
 *
 * Streamed, the first words land in about a second and the rest arrives as it
 * is written. Nothing is waiting on a single large response, so:
 *
 *  - **Fast**, because time-to-first-word replaces time-to-whole-answer.
 *  - **Complete**, because the token ceiling can be generous without the wait
 *    getting worse, and because a connection that is continuously sending bytes
 *    is not an idle request the platform will cut at `maxDuration`.
 *
 * Routed on the `briefing` task, so it takes the QUALITY model for everyone
 * regardless of plan - see `routeTier`. A briefing answered by the fast model
 * writes two sentences and stops, which is the bug this project already fixed
 * once and must not reintroduce through a new code path.
 */
export function streamBriefing(opts: {
  prompt: string;
  system?: string;
  maxTokens?: number;
  ctx?: GatewayCtx;
}): AsyncIterable<string> | null {
  if (!aiEnabled) return null;
  async function* run() {
    const handle = await runStream(
      "briefing",
      {
        system:
          opts.system ??
          "You are a crypto markets desk writer. Write in clear, plain English. " +
            "Use markdown headings and short paragraphs. Never invent facts.",
        messages: [{ role: "user", content: opts.prompt }],
        // Generous on purpose: with streaming, a higher ceiling costs nothing in
        // perceived latency - it only removes the reason an answer stops early.
        maxTokens: opts.maxTokens ?? 1600,
      },
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
  const res = await completeTextWithMeta(opts);
  return res?.text ?? null;
}

/** What the generation actually did. Small, and none of it is sensitive. */
export type CompleteMeta = {
  provider: string;
  model: string;
  /** "length" means the answer was CUT OFF at the token ceiling. */
  finishReason: "stop" | "length" | "other" | "unknown";
  outputTokens: number;
  /** Served from the 24h response cache rather than generated. */
  cached: boolean;
};

/**
 * `completeText`, but it also says what happened.
 *
 * ⚠️ This exists because a half-finished briefing was "fixed" three times
 * without anyone being able to see why it was short. A truncated answer and a
 * brief one are identical in the text; only `finishReason` separates them, and
 * both providers were discarding it.
 *
 * Nothing here is sensitive - a provider name, a model name, a token count and
 * a stop reason - so it can be handed to the caller and shown to an admin.
 */
export async function completeTextWithMeta(opts: {
  task?: AiTask;
  system?: string;
  prompt: string;
  maxTokens?: number;
  ctx?: GatewayCtx;
}): Promise<{ text: string; meta: CompleteMeta } | null> {
  if (!aiEnabled) return null;
  const res = await runComplete(
    opts.task ?? "summary",
    { system: opts.system, prompt: opts.prompt, maxTokens: opts.maxTokens ?? 300 },
    opts.ctx ?? {}
  );
  const text = res.text?.trim() || "";
  if (!text) return null;
  return {
    text,
    meta: {
      provider: res.provider,
      model: res.model,
      finishReason: res.finishReason ?? "unknown",
      outputTokens: res.usage?.outputTokens ?? 0,
      cached: res.provider === "cache",
    },
  };
}
