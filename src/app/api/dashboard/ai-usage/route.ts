import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, requirePermission } from "@/lib/api";
import { fillDailySeries } from "@/lib/timeseries";
import { providerHealth } from "@/lib/ai/registry";

export const dynamic = "force-dynamic";

const DAYS = 30;

// GET /api/dashboard/ai-usage - AI gateway analytics for the admin dashboard
// (ai:manage). Daily request + cost series, 30-day totals, provider split +
// health, top users and abuse flags. All best-effort so a not-yet-migrated DB
// (no AiUsage table) returns zeros instead of erroring.
export async function GET() {
  try {
    const actor = await requirePermission("ai:manage");
    if (!actor) return fail("Forbidden", 403);

    const now = Date.now();
    const since = new Date(now - DAYS * 86_400_000);
    const todayStart = new Date(Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate()));

    type DayRow = { day: Date; count: bigint };
    const [reqRows, costRows, todayCount, monthAgg, statusRows, cachedCount, providerRows, topRows, abuseRows] = await Promise.all([
      prisma.$queryRaw<DayRow[]>(Prisma.sql`SELECT date_trunc('day',"createdAt") AS day, count(*) AS count FROM "AiUsage" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`).catch(() => [] as DayRow[]),
      prisma.$queryRaw<DayRow[]>(Prisma.sql`SELECT date_trunc('day',"createdAt") AS day, coalesce(sum("estCostUsdMicros"),0) AS count FROM "AiUsage" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`).catch(() => [] as DayRow[]),
      prisma.aiUsage.count({ where: { createdAt: { gte: todayStart } } }).catch(() => 0),
      prisma.aiUsage.aggregate({ where: { createdAt: { gte: since } }, _count: true, _sum: { inputTokens: true, outputTokens: true, estCostUsdMicros: true } }).catch(() => null),
      prisma.aiUsage.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: true }).catch(() => [] as { status: string; _count: number }[]),
      prisma.aiUsage.count({ where: { createdAt: { gte: since }, cached: true } }).catch(() => 0),
      prisma.aiUsage.groupBy({ by: ["provider"], where: { createdAt: { gte: since } }, _count: true }).catch(() => [] as { provider: string; _count: number }[]),
      prisma.aiUsage
        .groupBy({ by: ["userId"], where: { createdAt: { gte: since }, userId: { not: null } }, _count: true, _sum: { estCostUsdMicros: true }, orderBy: { _count: { userId: "desc" } }, take: 10 })
        .catch(() => [] as { userId: string | null; _count: number; _sum: { estCostUsdMicros: number | null } }[]),
      prisma.aiUsage
        .groupBy({ by: ["userId"], where: { createdAt: { gte: since }, status: "error", userId: { not: null } }, _count: true, orderBy: { _count: { userId: "desc" } }, take: 5 })
        .catch(() => [] as { userId: string | null; _count: number }[]),
    ]);

    // Resolve user labels for the top-users + abuse tables.
    const ids = [...new Set([...topRows, ...abuseRows].map((r) => r.userId).filter((v): v is string => !!v))];
    const users = ids.length
      ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true, membership: true, aiDailyLimit: true } }).catch(() => [])
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));

    const statusOf = (s: string) => statusRows.find((r) => r.status === s)?._count ?? 0;
    const monthReq = monthAgg?._count ?? 0;

    const res = ok({
      days: DAYS,
      requests: fillDailySeries(reqRows, DAYS),
      cost: fillDailySeries(costRows, DAYS), // daily micro-USD
      totals: {
        today: todayCount,
        month: monthReq,
        inputTokens: monthAgg?._sum.inputTokens ?? 0,
        outputTokens: monthAgg?._sum.outputTokens ?? 0,
        costMicros: monthAgg?._sum.estCostUsdMicros ?? 0,
        errors: statusOf("error"),
        fallbacks: statusOf("fallback"),
        cached: cachedCount,
        cacheHitRate: monthReq > 0 ? cachedCount / monthReq : 0,
      },
      providers: providerHealth().map((p) => ({
        ...p,
        requests: providerRows.find((r) => r.provider === p.id)?._count ?? 0,
      })),
      topUsers: topRows.map((r) => {
        const u = r.userId ? byId.get(r.userId) : undefined;
        return {
          id: r.userId,
          name: u?.name ?? null,
          email: u?.email ?? null,
          membership: u?.membership ?? "Free",
          aiDailyLimit: u?.aiDailyLimit ?? null,
          requests: r._count,
          costMicros: r._sum.estCostUsdMicros ?? 0,
        };
      }),
      abuse: abuseRows.map((r) => {
        const u = r.userId ? byId.get(r.userId) : undefined;
        return { id: r.userId, name: u?.name ?? null, email: u?.email ?? null, errors: r._count };
      }),
    });
    res.headers.set("Cache-Control", "private, max-age=30");
    return res;
  } catch (err) {
    return handleError(err, "dashboard:ai-usage");
  }
}
