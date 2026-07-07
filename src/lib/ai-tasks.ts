// XYZ AI — server-side task helpers (summaries + chat moderation). Both are
// best-effort and degrade to a safe default: `summarize` returns null and
// `classifyToxic` returns false (fail-OPEN — never auto-hide on an error/outage)
// when AI is disabled, the model errors, or the call times out.
import { completeText } from "@/lib/ai";
import {
  buildSummaryPrompt,
  cleanSummary,
  buildModerationPrompt,
  parseModerationVerdict,
} from "@/lib/ai-summary";

/** Generate a short TL;DR for an article, or null on disable/empty/error. */
export async function summarize(title: string, content: string): Promise<string | null> {
  try {
    const raw = await completeText({
      task: "summary",
      prompt: buildSummaryPrompt(title, content),
      maxTokens: 160,
    });
    return raw ? cleanSummary(raw) : null;
  } catch (err) {
    console.error("[ai:summarize] failed", err);
    return null;
  }
}

// Bound the moderation call so a slow model never delays a chat send for long.
const MOD_TIMEOUT_MS = 4000;

/** Classify a chat message as toxic. Fail-open: false on disable/error/timeout. */
export async function classifyToxic(text: string): Promise<boolean> {
  try {
    const verdict = await Promise.race([
      completeText({ task: "moderation", prompt: buildModerationPrompt(text), maxTokens: 8 }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), MOD_TIMEOUT_MS)),
    ]);
    return verdict ? parseModerationVerdict(verdict) : false;
  } catch (err) {
    console.error("[ai:moderate] failed", err);
    return false;
  }
}
