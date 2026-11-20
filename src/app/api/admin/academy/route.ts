import { fail, requirePermission } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { adminModule, adminOp, adminOverview, adminQuestions, runAdminOp } from "@modules/academy/lib/admin";
import { academyError, json, PRIVATE } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/academy?view=overview|questions|module - staff with
// `academy:manage` only.
export async function GET(req: Request) {
  try {
    const me = await requirePermission("academy:manage");
    if (!me) return fail("Forbidden", 403);
    const url = new URL(req.url);
    const view = url.searchParams.get("view") ?? "overview";
    if (view === "questions") {
      const categoryId = url.searchParams.get("category") ?? "";
      if (!categoryId) return fail("category is required", 400);
      return json({ questions: await adminQuestions(categoryId, url.searchParams.get("module")) }, PRIVATE);
    }
    if (view === "module") {
      const mod = await adminModule(url.searchParams.get("id") ?? "");
      if (!mod) return fail("Not found", 404);
      return json({ module: mod }, PRIVATE);
    }
    return json(await adminOverview(), PRIVATE);
  } catch (err) {
    return academyError(err, "admin:academy:get");
  }
}

// POST /api/admin/academy { op, ... } - every content, config, live-quiz host,
// certificate and XP action. Validated per op (see adminOp) and audit-logged.
export async function POST(req: Request) {
  try {
    const me = await requirePermission("academy:manage");
    if (!me) return fail("Forbidden", 403);
    const { success } = await rateLimit("academyAdmin", me.id);
    if (!success) return fail("Too many changes at once. Wait a moment.", 429);
    const parsed = adminOp.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid request.", 400);
    return json(await runAdminOp(me.id, parsed.data), PRIVATE);
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") return fail("That slug is already used.", 409);
    return academyError(err, "admin:academy:post");
  }
}
