import "server-only";
import { prisma } from "@/lib/prisma";
import { env, aiEnabled, sentryConfigured } from "@/lib/env";
import type { Signals } from "@/lib/security-score";

// XYZ Sentinel — collects live security/health signals from the DB + config.
// Every query is guarded (.catch → safe default) so an un-migrated DB or a
// transient error never breaks the watchdog. Scoring lives in the pure,
// unit-tested `security-score.ts` (re-exported here for convenience).
export { scoreSignals } from "@/lib/security-score";
export type { Signals, Severity } from "@/lib/security-score";

const rateLimitLive = !!env.UPSTASH_REDIS_REST_URL && !!env.UPSTASH_REDIS_REST_TOKEN;
const pushLive = !!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!env.VAPID_PRIVATE_KEY;

export async function collectSignals(now = new Date(), windowMinutes = 60): Promise<Signals> {
  const since = new Date(now.getTime() - windowMinutes * 60_000);
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [locked, highFail, otpAgg, otpActive, aiCalls, aiErrors, aiCostAgg, adminActions] = await Promise.all([
    prisma.user.count({ where: { lockedUntil: { gt: now } } }).catch(() => 0),
    prisma.user.count({ where: { failedLoginCount: { gte: 3 } } }).catch(() => 0),
    prisma.verificationCode.aggregate({ where: { expiresAt: { gt: now } }, _max: { attempts: true } }).catch(() => ({ _max: { attempts: null } as { attempts: number | null } })),
    prisma.verificationCode.count({ where: { expiresAt: { gt: now } } }).catch(() => 0),
    prisma.aiUsage.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.aiUsage.count({ where: { createdAt: { gte: since }, status: "error" } }).catch(() => 0),
    prisma.aiUsage.aggregate({ where: { createdAt: { gte: dayStart } }, _sum: { estCostUsdMicros: true } }).catch(() => ({ _sum: { estCostUsdMicros: null } as { estCostUsdMicros: number | null } })),
    prisma.adminAudit.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
  ]);

  return {
    windowMinutes,
    isProd: process.env.NODE_ENV === "production",
    lockedAccounts: locked,
    highFailAccounts: highFail,
    otpAttemptsMax: otpAgg._max.attempts ?? 0,
    otpActiveCodes: otpActive,
    aiCalls,
    aiErrors,
    aiErrorRatePct: aiCalls > 0 ? Math.round((aiErrors / aiCalls) * 100) : 0,
    aiCostUsdToday: Math.round(((aiCostAgg._sum.estCostUsdMicros ?? 0) / 1_000_000) * 100) / 100,
    adminActions,
    config: { rateLimitLive, sentryConfigured, aiEnabled, pushLive },
  };
}
