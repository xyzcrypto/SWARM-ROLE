import "server-only";
// Gemini provider - Google Generative Language REST API (keyless SDK; plain fetch
// so there's no extra dependency and it works through the outbound proxy).
// Only `enabled` when GEMINI_API_KEY is configured. Server-only.
import { env, geminiEnabled } from "@/lib/env";
import type { AiProvider, ChatMessage, CompleteRequest, CompleteResult, FinishReason, StreamHandle, StreamRequest, TokenUsage } from "./types";
import { isGeminiThinkingModel, outputCeiling, thinkingBudgetFor } from "./reasoning";

/**
 * The model, overridable from the dashboard (`GEMINI_MODEL`) without a deploy.
 *
 * ⚠️ Model ids get retired. If the configured one is not found, the provider walks
 * `FALLBACK_MODELS` instead of failing every request - `gemini-flash-latest` is
 * Google's rolling alias for the current Flash model, so it survives renames.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";
const CONFIGURED = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
export const FALLBACK_MODELS = ["gemini-flash-latest", "gemini-2.5-flash"];
const MODELS = { fast: CONFIGURED, quality: CONFIGURED } as const;
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type UsageMeta = { promptTokenCount?: number; candidatesTokenCount?: number };
function usageOf(md: UsageMeta | undefined): TokenUsage | undefined {
  if (!md) return undefined;
  return { inputTokens: Number(md.promptTokenCount) || 0, outputTokens: Number(md.candidatesTokenCount) || 0 };
}

type Part = { text?: string; thought?: boolean };
type Candidate = { content?: { parts?: Part[] }; finishReason?: string };
type GenResponse = { candidates?: Candidate[]; usageMetadata?: UsageMeta };

/** The visible answer only - a `thought` part (if the API ever returns one) is never shown to a reader. */
export function textOf(j: GenResponse): string {
  return (j?.candidates?.[0]?.content?.parts ?? []).filter((p) => !p?.thought).map((p) => p?.text ?? "").join("");
}
function toContents(messages: ChatMessage[]) {
  // Gemini uses "model" for the assistant role.
  return messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
}

/**
 * generationConfig for a request whose ANSWER may be `answerTokens` long.
 * For a thinking model: thinking is capped, and the ceiling grows by the
 * headroom so the cap can never come out of the answer (see reasoning.ts).
 */
export function generationConfig(model: string, answerTokens: number, withThinkingCap = true) {
  const thinks = isGeminiThinkingModel(model);
  return {
    maxOutputTokens: outputCeiling(answerTokens, thinks),
    ...(thinks && withThinkingCap ? { thinkingConfig: { thinkingBudget: thinkingBudgetFor(answerTokens) } } : {}),
  };
}

// Which model actually answers for a configured id, once a fallback was needed.
const resolved = new Map<string, string>();
const candidatesFor = (model: string) => [...new Set([resolved.get(model) ?? model, model, ...FALLBACK_MODELS])];

/**
 * POST to Gemini with the two recoveries that keep a misconfiguration from
 * looking like "AI is broken":
 *  - 404 (model not found / retired) → next candidate model, remembered.
 *  - 400 about the thinking config (a model that rejects the field) → the same
 *    model again without it; the extra headroom still protects the answer.
 */
async function post(model: string, method: string, build: (m: string, cap: boolean) => unknown, signal?: AbortSignal): Promise<{ res: Response; served: string }> {
  let last: Response | null = null;
  for (const m of candidatesFor(model)) {
    for (const cap of [true, false]) {
      const res = await fetch(`${BASE}/${m}:${method}${method.includes("?") ? "&" : "?"}key=${env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(build(m, cap)),
        signal,
      });
      if (res.ok) {
        if (m !== model) resolved.set(model, m);
        return { res, served: m };
      }
      last = res;
      if (res.status === 400 && cap) {
        const body = await res.clone().text();
        if (/thinking/i.test(body)) continue; // retry this model without the cap
      }
      break; // not a thinking-config problem: decide below whether to try another model
    }
    if (last && last.status !== 404) break; // only a missing model is worth another id
  }
  const r = last!;
  throw new Error(`gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

export const geminiProvider: AiProvider = {
  id: "gemini",
  enabled: geminiEnabled,
  models: MODELS,

  async complete(req: CompleteRequest): Promise<CompleteResult> {
    const { res, served } = await post(
      req.model,
      "generateContent",
      (m, cap) => ({
        ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
        contents: [{ role: "user", parts: [{ text: req.prompt }] }],
        generationConfig: generationConfig(m, req.maxTokens, cap),
      }),
      req.signal
    );
    const j = (await res.json()) as GenResponse;
    // ⚠️ Carried, not dropped. Gemini spells it MAX_TOKENS; that means the
    // answer was cut off at the ceiling rather than the model being brief, and
    // the text alone cannot tell you which.
    const raw = j?.candidates?.[0]?.finishReason;
    const finishReason: FinishReason =
      raw === "MAX_TOKENS" ? "length" : raw === "STOP" ? "stop" : "other";
    return { text: textOf(j).trim(), usage: usageOf(j.usageMetadata), finishReason, ...(served !== req.model ? { servedModel: served } : {}) };
  },

  async streamChat(req: StreamRequest): Promise<StreamHandle> {
    const { res } = await post(
      req.model,
      "streamGenerateContent?alt=sse",
      (m, cap) => ({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: toContents(req.messages),
        generationConfig: generationConfig(m, req.maxTokens, cap),
      }),
      req.signal
    );
    if (!res.body) throw new Error("gemini 200: no stream body");
    let usage: TokenUsage | undefined;
    const reader = res.body.getReader();
    async function* run() {
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE frames are line-delimited "data: {json}" (alt=sse gives one JSON per line).
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload) as GenResponse;
            const text = textOf(j);
            if (text) yield text;
            if (j.usageMetadata) usage = usageOf(j.usageMetadata);
          } catch {
            /* ignore a rare partial frame */
          }
        }
      }
    }
    return { stream: run(), getUsage: () => usage };
  },
};
