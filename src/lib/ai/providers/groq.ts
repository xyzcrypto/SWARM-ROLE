// Groq provider - the OpenAI-compatible Llama models. Server-only.
import Groq from "groq-sdk";
import { env, groqEnabled } from "@/lib/env";
import type { AiProvider, CompleteRequest, CompleteResult, StreamHandle, StreamRequest, TokenUsage } from "./types";

const MODELS = { fast: "llama-3.1-8b-instant", quality: "llama-3.3-70b-versatile" } as const;

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
        max_tokens: req.maxTokens,
        messages: [
          ...(req.system ? [{ role: "system" as const, content: req.system }] : []),
          { role: "user" as const, content: req.prompt },
        ],
      },
      { signal: req.signal }
    );
    return { text: res.choices[0]?.message?.content?.trim() ?? "", usage: usageOf(res.usage) };
  },

  async streamChat(req: StreamRequest): Promise<StreamHandle> {
    // Groq's SDK types don't expose stream usage; token counts for the streamed
    // assistant are estimated by the gateway from the input + accumulated output.
    const stream = await client().chat.completions.create(
      {
        model: req.model,
        max_tokens: req.maxTokens,
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
