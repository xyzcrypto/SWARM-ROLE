import "server-only";
// Gemini provider - Google Generative Language REST API (keyless SDK; plain fetch
// so there's no extra dependency and it works through the outbound proxy).
// Only `enabled` when GEMINI_API_KEY is configured. Server-only.
import { env, geminiEnabled } from "@/lib/env";
import type { AiProvider, ChatMessage, CompleteRequest, CompleteResult, StreamHandle, StreamRequest, TokenUsage } from "./types";

// gemini-2.0-flash is faster and cheaper than 1.5-pro with comparable quality
// for Q&A. Use it for both tiers — 1.5-pro had rate issues on free quota.
const MODELS = { fast: "gemini-2.0-flash", quality: "gemini-2.0-flash" } as const;
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type UsageMeta = { promptTokenCount?: number; candidatesTokenCount?: number };
function usageOf(md: UsageMeta | undefined): TokenUsage | undefined {
  if (!md) return undefined;
  return { inputTokens: Number(md.promptTokenCount) || 0, outputTokens: Number(md.candidatesTokenCount) || 0 };
}

type Part = { text?: string };
type Candidate = { content?: { parts?: Part[] } };
type GenResponse = { candidates?: Candidate[]; usageMetadata?: UsageMeta };

function textOf(j: GenResponse): string {
  return (j?.candidates?.[0]?.content?.parts ?? []).map((p) => p?.text ?? "").join("");
}
function toContents(messages: ChatMessage[]) {
  // Gemini uses "model" for the assistant role.
  return messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
}

export const geminiProvider: AiProvider = {
  id: "gemini",
  enabled: geminiEnabled,
  models: MODELS,

  async complete(req: CompleteRequest): Promise<CompleteResult> {
    const body = {
      ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
      contents: [{ role: "user", parts: [{ text: req.prompt }] }],
      generationConfig: { maxOutputTokens: req.maxTokens },
    };
    const res = await fetch(`${BASE}/${req.model}:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: req.signal,
    });
    if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = (await res.json()) as GenResponse;
    return { text: textOf(j).trim(), usage: usageOf(j.usageMetadata) };
  },

  async streamChat(req: StreamRequest): Promise<StreamHandle> {
    const body = {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: toContents(req.messages),
      generationConfig: { maxOutputTokens: req.maxTokens },
    };
    const res = await fetch(`${BASE}/${req.model}:streamGenerateContent?alt=sse&key=${env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: req.signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`gemini ${res.status}: ${res.ok ? "no stream body" : (await res.text()).slice(0, 200)}`);
    }
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
