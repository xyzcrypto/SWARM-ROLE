import { ok, fail, handleError, requirePermission } from "@/lib/api";
import { getDashboardStats } from "@/lib/dashboard-stats";

export const dynamic = "force-dynamic";

// GET /api/dashboard/stats - live dashboard numbers (requires `dashboard:view`).
// Short private cache so frequent refreshes stay cheap.
export async function GET() {
  try {
    const me = await requirePermission("dashboard:view");
    if (!me) return fail("Forbidden", 403);
    const stats = await getDashboardStats();
    const res = ok({ stats });
    res.headers.set("Cache-Control", "private, max-age=10");
    return res;
  } catch (err) {
    return handleError(err, "dashboard:stats");
  }
}
