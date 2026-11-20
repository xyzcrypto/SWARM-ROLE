import { fail, requirePermission } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { adminList, adminPatch, adminSetStatus } from "@modules/feedback/lib/feedback";
import { academyError, json, PRIVATE } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/feedback?status=new|seen|done&cursor= - staff with `feedback:manage`.
export async function GET(req: Request) {
  try {
    const me = await requirePermission("feedback:manage");
    if (!me) return fail("Forbidden", 403);
    const url = new URL(req.url);
    return json(await adminList(url.searchParams.get("status"), url.searchParams.get("cursor")), PRIVATE);
  } catch (err) {
    return academyError(err, "admin:feedback:get");
  }
}

// PATCH /api/admin/feedback { id, status } - "done" pays the member XP once.
export async function PATCH(req: Request) {
  try {
    const me = await requirePermission("feedback:manage");
    if (!me) return fail("Forbidden", 403);
    const { success } = await rateLimit("feedbackAdmin", me.id);
    if (!success) return fail("Too many changes at once. Wait a moment.", 429);
    const parsed = adminPatch.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid request.", 400);
    return json(await adminSetStatus(me.id, parsed.data.id, parsed.data.status), PRIVATE);
  } catch (err) {
    if ((err as { code?: string })?.code === "P2025") return fail("Not found", 404);
    return academyError(err, "admin:feedback:patch");
  }
}
