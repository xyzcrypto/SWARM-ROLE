import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, requirePermission } from "@/lib/api";
import { fillDailySeries } from "@/lib/timeseries";

export const dynamic = "force-dynamic";

const DAYS = 30;

// GET /api/dashboard/timeseries - daily signups + page views for the Overview
// charts (dashboard:view). Bucketed in Postgres (date_trunc, no user input in
// the SQL), zero-filled server-side so the client renders a dumb series.
export async function GET() {
  try {
    const actor = await requirePermission("dashboard:view");
    if (!actor) return fail("Forbidden", 403);

    const since = new Date(Date.now() - DAYS * 86_400_000);

    type Row = { day: Date; count: bigint };
    const [signupRows, viewRows] = await Promise.all([
      prisma
        .$queryRaw<Row[]>(
          Prisma.sql`SELECT date_trunc('day', "createdAt") AS day, count(*) AS count
                     FROM "User" WHERE "createdAt" >= ${since}
                     GROUP BY 1 ORDER BY 1`
        )
        .catch(() => [] as Row[]),
      prisma
        .$queryRaw<Row[]>(
          Prisma.sql`SELECT date_trunc('day', "createdAt") AS day, count(*) AS count
                     FROM "PageView" WHERE "createdAt" >= ${since}
                     GROUP BY 1 ORDER BY 1`
        )
        .catch(() => [] as Row[]),
    ]);

    const res = ok({
      days: DAYS,
      signups: fillDailySeries(signupRows, DAYS),
      views: fillDailySeries(viewRows, DAYS),
    });
    // Charts don't need to be second-fresh; spare the DB on tab switches.
    res.headers.set("Cache-Control", "private, max-age=60");
    return res;
  } catch (err) {
    return handleError(err, "dashboard:timeseries");
  }
}
