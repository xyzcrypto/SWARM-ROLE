import type { AiTask, AiTier } from "./providers/types";

/**
 * Which model tier a task should use.
 *  - The research **assistant** is the complex, high-value path → quality model.
 *  - Bulk deterministic tasks (summaries, moderation, why-matters, digests) are
 *    cheap and high-volume → the fast model.
 *
 * Plan-based gating of the assistant tier (e.g. Free → fast) is layered on in a
 * later pass; today every plan gets the quality model for the assistant, so this
 * refactor changes no behavior.
 */
export function routeTier(task: AiTask): AiTier {
  return task === "assistant" ? "quality" : "fast";
}
