import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";

// Public live site stats (visits today/total + member count). Lightly cached at
// the edge so it can update every few seconds without hammering the DB. All
// counts degrade to 0 on any DB hiccup (never throws to the client).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [visitsToday, totalVisits, members] = await Promise.all([
      prisma.pageView.count({ where: { createdAt: { gte: startOfToday } } }).catch(() => 0),
      prisma.pageView.count().catch(() => 0),
      prisma.user.count().catch(() => 0),
    ]);

    const res = ok({ visitsToday, totalVisits, members });
    res.headers.set("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
    return res;
  } catch (err) {
    return handleError(err, "live:stats");
  }
}
