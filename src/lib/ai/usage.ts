import "server-only";
import { prisma } from "@/lib/prisma";
import type { AiTask } from "./providers/types";

export type AiStatus = "ok" | "fallback" | "error";

export type UsageRow = {
  userId?: string | null;
  provider: string;
  model: string;
  task: AiTask;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: AiStatus;
  errorKind?: string | null;
  estCostUsdMicros: number;
  cached?: boolean;
};

/** Short, stable error category for the analytics row (never store raw messages). */
export function errorKindOf(err: unknown): string {
  const s = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (/(safety|blocked|content.?filter|flagged|recitation)/.test(s)) return "safety";
  if (/(429|quota|rate.?limit|resource_exhausted|too many requests)/.test(s)) return "rate_limit";
  if (/(api.?key|401|403|permission|unauthorized|invalid.*key)/.test(s)) return "auth";
  if (/(timeout|timed out|aborted|abort)/.test(s)) return "timeout";
  if (/(50\d|unavailable|overloaded|network|fetch failed|econnreset|socket)/.test(s)) return "server";
  // ⚠️ The rest of 4xx had no bucket at all. Every branch above covers 401, 403,
  // 429 or 5xx, so a 400/404 - a bad request, or a model name the provider no
  // longer serves ("decommissioned", "does not exist") - fell straight through
  // to "unknown". That is a permanent, code-side failure being filed under the
  // one label that says nothing, and a real AI outage showed ten rows of exactly
  // that with no way to tell them apart from anything else.
  //
  // This closes the classification hole. It does NOT claim to be the cause of
  // any particular outage - the gateway's `[ai] all providers failed` log is
  // what carries the actual message.
  if (/(\b400\b|\b404\b|bad request|not found|decommissioned|does not exist|unsupported|deprecated)/.test(s))
    return "bad_request";
  return "unknown";
}

/**
 * Persist one usage row. Best-effort: a not-yet-migrated DB (P2021/P2022) or any
 * transient error is swallowed so metering never breaks an AI request. Stores
 * metadata only - never the prompt or response text.
 */
export async function recordAiUsage(row: UsageRow): Promise<void> {
  try {
    await prisma.aiUsage.create({
      data: {
        userId: row.userId ?? null,
        provider: row.provider,
        model: row.model,
        task: row.task,
        inputTokens: Math.max(0, Math.round(row.inputTokens)),
        outputTokens: Math.max(0, Math.round(row.outputTokens)),
        latencyMs: Math.max(0, Math.round(row.latencyMs)),
        status: row.status,
        errorKind: row.errorKind ?? null,
        estCostUsdMicros: Math.max(0, Math.round(row.estCostUsdMicros)),
        cached: row.cached ?? false,
      },
    });
  } catch {
    /* pre-migration or transient - analytics is best-effort, never fatal */
  }
}
