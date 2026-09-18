import type { AiTask, AiTier, AiPlan } from "./providers/types";

/**
 * Which model tier a task should use, given the member's plan:
 *  - Bulk deterministic tasks (summaries, moderation, why-matters, digests) are
 *    cheap + high-volume → always the **fast** model.
 *  - The research **assistant** is the complex, high-value path. Premium/Admin
 *    get the **quality** model; Free members get the **fast** model (still
 *    capable, and it keeps the free tier cheap + fast). This is the intended
 *    plan-based routing - "the best model available for that user's plan".
 */
export function routeTier(task: AiTask, plan: AiPlan = "Free"): AiTier {
  // ⚠️ A full briefing is NOT bulk deterministic work. It is a nine-section,
  // 650-900 word explainer, and it used to share the `digest` task - so it was
  // answered by the fast model, which wrote a couple of sentences and stopped.
  //
  // It gets the quality model for everyone, regardless of plan, because a
  // briefing that stops after the TL;DR is not a cheaper briefing: it is a
  // feature that does not work, generated and paid for anyway.
  if (task === "briefing") return "quality";
  if (task !== "assistant") return "fast";
  return plan === "Free" ? "fast" : "quality";
}
