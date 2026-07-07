import type { AiTask, AiTier, AiPlan } from "./providers/types";

/**
 * Which model tier a task should use, given the member's plan:
 *  - Bulk deterministic tasks (summaries, moderation, why-matters, digests) are
 *    cheap + high-volume → always the **fast** model.
 *  - The research **assistant** is the complex, high-value path. Premium/Admin
 *    get the **quality** model; Free members get the **fast** model (still
 *    capable, and it keeps the free tier cheap + fast). This is the intended
 *    plan-based routing — "the best model available for that user's plan".
 */
export function routeTier(task: AiTask, plan: AiPlan = "Free"): AiTier {
  if (task !== "assistant") return "fast";
  return plan === "Free" ? "fast" : "quality";
}
