import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const schema = z.object({ path: z.string().trim().max(200) });

// POST /api/track - record a page view (public, rate-limited). Best-effort:
// always returns ok so a tracking blip never affects the user's page.
export async function POST(req: Request) {
  try {
    const { success } = await rateLimit("subscribe", clientIp(req));
    if (!success) return ok({ ok: true }); // silently drop excess pings

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    const path = parsed.success ? parsed.data.path : "/";

    await prisma.pageView.create({ data: { path } }).catch(() => null);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err, "track");
  }
}
