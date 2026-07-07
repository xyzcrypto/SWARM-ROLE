// Provider-agnostic contracts for the XYZ AI gateway. Everything the app touches
// is expressed here, so providers (Groq, Gemini, …) are fully interchangeable and
// the rest of the codebase never imports a vendor SDK directly.

/** The kind of work a call represents (drives model routing + usage analytics). */
export type AiTask = "assistant" | "summary" | "moderation" | "why" | "digest";

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
export type CompleteResult = { text: string; usage?: TokenUsage };

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
