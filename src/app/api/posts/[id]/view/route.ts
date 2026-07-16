import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, isCuid } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/posts/:id/view - public, rate-limited, best-effort view counter.
// Decoupled from page rendering (research/[slug] is ISR for free posts) so
// it's accurate regardless of cache state: fires once per real client mount,
// not once per cache fill.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!isCuid(params.id)) return fail("Invalid id.", 400);
    const { success } = await rateLimit("postView", clientIp(req));
    if (!success) return ok({ ok: true }); // silently drop excess pings
    await prisma.post.update({ where: { id: params.id }, data: { views: { increment: 1 } } }).catch(() => null);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err, "post:view");
  }
}
