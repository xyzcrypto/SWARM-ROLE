// Provider-agnostic contracts for the XYZ AI gateway. Everything the app touches
// is expressed here, so providers (Groq, Gemini, …) are fully interchangeable and
// the rest of the codebase never imports a vendor SDK directly.

/** The kind of work a call represents (drives model routing + usage analytics). */
/**
 * ⚠️ `briefing` is separate from `digest` on purpose, and the distinction is
 * load-bearing rather than cosmetic.
 *
 * A digest is two or three sentences. A BRIEFING is a nine-section, 650-900 word
 * explainer. They were the same task, so the briefing inherited the routing
 * written for "cheap + high-volume" work and was answered by the **fast** model -
 * which produced a couple of sentences and stopped. The reported symptom was
 * exactly that: "half se bhi kam".
 */
export type AiTask = "assistant" | "summary" | "moderation" | "why" | "digest" | "briefing";

/** A user's effective plan for AI purposes. */
export type AiPlan = "Free" | "Premium" | "Admin";

/** Model tier a provider exposes: a cheap/fast one and a higher-quality one. */
export type AiTier = "fast" | "quality";

export type TokenUsage = { inputTokens: number; outputTokens: number };
export type ChatMessage = { role: "user" | "assistant"; content: string };

export type CompleteRequest = {
  model: string;
  system?: string;
  prompt: string;
  maxTokens: number;
  signal?: AbortSignal;
};
/**
 * Why generation stopped.
 *
 * ⚠️ Both providers return this and BOTH were discarding it - Groq as
 * `choices[0].finish_reason`, Gemini as `candidates[0].finishReason`. Without it
 * a short answer is unexplainable: nobody can tell whether the model was cut off
 * at the token ceiling or simply decided it was done. Three separate attempts to
 * fix a half-finished briefing were made without this fact.
 *
 * - `stop`   - the model finished on its own.
 * - `length` - it hit `maxTokens`. The answer is TRUNCATED.
 * - `other`  - filtered, blocked, or a reason we do not model.
 */
export type FinishReason = "stop" | "length" | "other";

/**
 * `servedModel` is set only when the provider answered with a DIFFERENT model than
 * the one requested (e.g. Gemini falling back from a retired model id), so the
 * health check and usage rows can say what actually ran.
 */
export type CompleteResult = { text: string; usage?: TokenUsage; finishReason?: FinishReason; servedModel?: string };

export type StreamRequest = {
  model: string;
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  signal?: AbortSignal;
};

/**
 * A streaming response: an async iterable of plain text deltas plus `getUsage()`,
 * which becomes populated once the stream is fully consumed (providers report
 * token usage in the final chunk).
 */
export type StreamHandle = {
  stream: AsyncIterable<string>;
  getUsage: () => TokenUsage | undefined;
};

export interface AiProvider {
  readonly id: string; // "groq" | "gemini"
  readonly enabled: boolean; // key configured?
  readonly models: Record<AiTier, string>;
  complete(req: CompleteRequest): Promise<CompleteResult>;
  streamChat(req: StreamRequest): Promise<StreamHandle>;
}
