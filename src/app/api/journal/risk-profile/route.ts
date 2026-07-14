import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/journal/risk-profile - the signed-in member's own risk limits, or
// null if they haven't configured any yet (breach detection just no-ops).
export async function GET() {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    const profile = await prisma.riskProfile.findUnique({ where: { userId: me.id } }).catch(() => null);
    return ok({ profile });
  } catch (err) {
    return handleError(err, "journal:risk-profile:get");
  }
}

const profileSchema = z.object({
  accountEquity: z.number().positive().max(1_000_000_000).nullable().optional(),
  maxRiskPerTradePct: z.number().positive().max(100).nullable().optional(),
  maxDailyLossPct: z.number().positive().max(100).nullable().optional(),
  maxWeeklyDrawdownPct: z.number().positive().max(100).nullable().optional(),
  maxOpenRiskPct: z.number().positive().max(100).nullable().optional(),
  maxLeverage: z.number().positive().max(200).nullable().optional(),
  maxTradesPerDay: z.number().int().positive().max(1000).nullable().optional(),
  revengeCooldownMinutes: z.number().int().min(0).max(1440).nullable().optional(),
});

// PUT /api/journal/risk-profile - create or update the member's risk limits.
export async function PUT(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    const { success } = await rateLimit("journal", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = profileSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.", 400);
    const data = parsed.data;

    const profile = await prisma.riskProfile.upsert({
      where: { userId: me.id },
      create: { userId: me.id, ...data },
      update: data,
    });
    return ok({ profile });
  } catch (err) {
    return handleError(err, "journal:risk-profile:put");
  }
}
