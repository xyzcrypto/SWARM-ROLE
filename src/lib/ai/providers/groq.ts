import "server-only";
// Groq provider - the OpenAI-compatible Llama models. Server-only.
import Groq from "groq-sdk";
import { env, groqEnabled } from "@/lib/env";
import type { AiProvider, CompleteRequest, CompleteResult, FinishReason, StreamHandle, StreamRequest, TokenUsage } from "./types";
import { isGroqReasoningModel, outputCeiling } from "./reasoning";

// openai/gpt-oss-120b is the available model on this Groq account (overridable
// with GROQ_MODEL). Gemini is primary; Groq is the fallback.
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
const CONFIGURED = env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
const MODELS = { fast: CONFIGURED, quality: CONFIGURED } as const;

/**
 * Token + reasoning parameters for a request whose ANSWER may be `answerTokens`.
 *
 * ⚠️ gpt-oss reasons before it answers and those tokens come out of `max_tokens`,
 * so a 160-token "why this matters" could think its way to an empty reply. A
 * reasoning model gets low effort (these are summaries, not proofs) and headroom
 * on top of the answer. A non-reasoning model gets neither: Llama rejects
 * `reasoning_effort` outright.
 */
export function groqParams(model: string, answerTokens: number) {
  const reasons = isGroqReasoningModel(model);
  return { max_tokens: outputCeiling(answerTokens, reasons), ...(reasons ? { reasoning_effort: "low" as const } : {}) };
}

// One lazily-constructed client per server instance.
let _client: Groq | null = null;
function client(): Groq {
  if (!_client) _client = new Groq({ apiKey: env.GROQ_API_KEY });
  return _client;
}

function usageOf(u: { prompt_tokens?: number; completion_tokens?: number } | null | undefined): TokenUsage | undefined {
  if (!u) return undefined;
  return { inputTokens: u.prompt_tokens ?? 0, outputTokens: u.completion_tokens ?? 0 };
}

export const groqProvider: AiProvider = {
  id: "groq",
  enabled: groqEnabled,
  models: MODELS,

  async complete(req: CompleteRequest): Promise<CompleteResult> {
    const res = await client().chat.completions.create(
      {
        model: req.model,
        ...groqParams(req.model, req.maxTokens),
        messages: [
          ...(req.system ? [{ role: "system" as const, content: req.system }] : []),
          { role: "user" as const, content: req.prompt },
        ],
      },
      { signal: req.signal }
    );
    // ⚠️ `finish_reason` is carried, not dropped. "length" means the answer was
    // cut off at the token ceiling - the difference between "the model was brief"
    // and "we truncated it", which is not recoverable from the text alone.
    const raw = res.choices[0]?.finish_reason;
    const finishReason: FinishReason = raw === "length" ? "length" : raw === "stop" ? "stop" : "other";
    return {
      text: res.choices[0]?.message?.content?.trim() ?? "",
      usage: usageOf(res.usage),
      finishReason,
    };
  },

  async streamChat(req: StreamRequest): Promise<StreamHandle> {
    // Groq's SDK types don't expose stream usage; token counts for the streamed
    // assistant are estimated by the gateway from the input + accumulated output.
    const stream = await client().chat.completions.create(
      {
        model: req.model,
        ...groqParams(req.model, req.maxTokens),
        stream: true,
        messages: [
          { role: "system", content: req.system },
          ...req.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      },
      { signal: req.signal }
    );
    async function* run() {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) yield text;
      }
    }
    return { stream: run(), getUsage: () => undefined };
  },
};
