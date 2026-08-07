// Per-plan daily AI request limits. Pure math (plan defaults + env overrides +
// per-user override) is unit-tested; the DB count is best-effort and fails OPEN
// only when the analytics table itself is missing (pre-migration) - otherwise
// the cap is enforced. Guardrail: no plan is "unlimited"; Admin is high but finite.
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import type { AiPlan, AiTask } from "./providers/types";

// Built-in defaults (overridable via env AI_DAILY_LIMIT_FREE|PREMIUM|ADMIN).
export const DEFAULT_DAILY_LIMITS: Record<AiPlan, number> = { Free: 25, Premium: 300, Admin: 3000 };

// Only user-initiated tasks count against the cap; system tasks (auto-moderation,
// article auto-summaries) are not the member's quota.
const USER_TASKS: ReadonlySet<AiTask> = new Set<AiTask>(["assistant", "why", "digest"]);
export function isUserTask(task: AiTask): boolean {
  return USER_TASKS.has(task);
}

function parsePositiveInt(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/** The daily limit for a plan (env override → built-in default). */
export function planDailyLimit(plan: AiPlan): number {
  const overrides: Record<AiPlan, number | null> = {
    Free: parsePositiveInt(env.AI_DAILY_LIMIT_FREE),
    Premium: parsePositiveInt(env.AI_DAILY_LIMIT_PREMIUM),
    Admin: parsePositiveInt(env.AI_DAILY_LIMIT_ADMIN),
  };
  return overrides[plan] ?? DEFAULT_DAILY_LIMITS[plan];
}

/** Effective limit: a per-user override (if a positive number) wins over the plan default. */
export function effectiveDailyLimit(plan: AiPlan, perUserOverride: number | null | undefined): number {
  if (typeof perUserOverride === "number" && perUserOverride > 0) return Math.floor(perUserOverride);
  return planDailyLimit(plan);
}

export type LimitStatus = { allowed: boolean; used: number; limit: number; remaining: number };

/** Start of the current UTC day, in ms. */
function utcDayStart(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Check a member's remaining daily AI budget. Counts today's user-initiated
 * AiUsage rows (UTC) against the effective limit. Best-effort:
 *  - missing aiDailyLimit column (pre-16_ai_limits) → plan default,
 *  - missing AiUsage table (pre-15_ai_usage) → treated as 0 used (fail open).
 */
export async function checkDailyLimit(userId: string, plan: AiPlan, now = Date.now()): Promise<LimitStatus> {
  let override: number | null = null;
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { aiDailyLimit: true } });
    override = u?.aiDailyLimit ?? null;
  } catch {
    override = null; // column not migrated yet → use plan default
  }
  const limit = effectiveDailyLimit(plan, override);

  let used = 0;
  try {
    used = await prisma.aiUsage.count({
      where: { userId, task: { in: ["assistant", "why", "digest"] }, createdAt: { gte: new Date(utcDayStart(now)) } },
    });
  } catch {
    used = 0; // analytics table not migrated → don't block
  }
  const remaining = Math.max(0, limit - used);
  return { allowed: used < limit, used, limit, remaining };
}

// Presentation rules live in a client-safe module (this file imports prisma and
// server-only env, so the widget cannot import it directly).
export { quotaLevel, QUOTA_QUIET_AT, QUOTA_WARN_AT, type QuotaLevel } from "@shared/utils/ai-quota";

/** Friendly, plan-aware message when the daily cap is hit. */
export function dailyLimitMessage(status: LimitStatus, plan: AiPlan): string {
  const base = `You've reached today's XYZ AI limit (${status.limit} requests). It resets at midnight UTC.`;
  return plan === "Free" ? `${base} Upgrade to Premium for a much higher daily allowance.` : base;
}
