import { fail, isCuid, requirePermission } from "@/lib/api";
import { inlineScreenshot } from "@modules/feedback/lib/feedback";
import { academyError } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/feedback/image?id= - one feedback screenshot that was stored
// inline (a data: URL, when Storage was off or failing), served as an image
// for staff with `feedback:manage`. The admin list links here instead of
// carrying up to ~700 KB per row inside its JSON (review L3), so a screenshot
// is fetched only when its card scrolls into view (`loading="lazy"`).
export async function GET(req: Request) {
  try {
    const me = await requirePermission("feedback:manage");
    if (!me) return fail("Forbidden", 403);
    const id = new URL(req.url).searchParams.get("id");
    if (!isCuid(id)) return fail("Invalid id.", 400);
    const shot = await inlineScreenshot(id);
    if (!shot) return fail("Not found", 404);
    return new Response(new Uint8Array(shot.bytes), {
      headers: {
        "Content-Type": shot.mime,
        // Personal to staff; the browser may keep it, no shared cache may.
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch (err) {
    return academyError(err, "admin:feedback:image");
  }
}
