/**
 * Hidden reasoning, and why every token budget on this site was quietly wrong.
 *
 * ⚠️ On 2026-08-20 both providers moved to models that THINK before they answer:
 * Gemini to a 3.x Flash model and Groq to `openai/gpt-oss-120b`. For both, the
 * thinking tokens are spent out of the SAME output budget as the answer
 * (`maxOutputTokens` / `max_tokens`). Every `maxTokens` in this codebase was sized
 * for the visible answer of a non-thinking model, so:
 *
 * - short tasks ("why this matters" = 160, moderation = 8, coin brief = 260) could
 *   spend the whole budget thinking and come back EMPTY;
 * - long tasks (the news briefing, the Points roundup) stopped early with
 *   `finishReason: length`, which is the "slow and cut off" briefing that four
 *   earlier rounds of fixes treated as a timeout / ceiling / continuation problem.
 *
 * The fix is to treat `maxTokens` as what it always meant - the length of the
 * ANSWER - and give the model's thinking its own, separate allowance on top.
 */

/** Cap on how much a Gemini thinking model may think per request. */
export const GEMINI_THINKING_BUDGET = 512;

/**
 * Thinking allowance for an answer of this length. A verdict or a one-word
 * label (moderation asks for 8 tokens, behind a 4s timeout) gains nothing from
 * reasoning and only gets slow enough to time out, so tiny answers think not at
 * all; everything else gets the capped budget.
 */
export function thinkingBudgetFor(answerTokens: number): number {
  return answerTokens <= 64 ? 0 : GEMINI_THINKING_BUDGET;
}

/**
 * Extra output allowance on top of the answer budget, for reasoning tokens.
 * Billing is per token actually generated, so headroom that goes unused costs
 * nothing; it only stops thinking from eating the answer.
 */
export const REASONING_HEADROOM = 2048;

/** Gemini models that think by default (2.5 and every later generation, and the `-latest` aliases). */
export function isGeminiThinkingModel(model: string): boolean {
  return /gemini-(?:2\.5|[3-9])|gemini-(?:flash|pro)(?:-lite)?-latest/i.test(model);
}

/**
 * Groq models that reason before answering and accept `reasoning_effort`.
 * ⚠️ Sending that parameter to a non-reasoning model (Llama) is a 400, so it is
 * only ever added for these.
 */
export function isGroqReasoningModel(model: string): boolean {
  return /gpt-oss|qwen3|deepseek-r1/i.test(model);
}

/** The total output ceiling to request: the answer budget plus reasoning headroom when the model thinks. */
export function outputCeiling(answerTokens: number, thinks: boolean): number {
  return thinks ? answerTokens + REASONING_HEADROOM : answerTokens;
}
