import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { CATEGORIES } from "@/lib/news";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID = new Set<string>(CATEGORIES);

// GET /api/news/interests — the signed-in member's followed categories.
export async function GET() {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    // Tolerate a not-yet-migrated DB (missing column) → empty interests.
    const row = await prisma.user
      .findUnique({ where: { id: me.id }, select: { newsInterests: true } })
      .catch(() => null);
    return ok({ interests: row?.newsInterests ?? [] });
  } catch (err) {
    return handleError(err, "news:interests:get");
  }
}

const bodySchema = z.object({ interests: z.array(z.string()).max(30) });

// POST /api/news/interests — save the member's followed categories (validated
// against the known category list).
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);

    const { success } = await rateLimit("profile", me.id);
    if (!success) return fail("Too many updates. Please slow down.", 429);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid input.", 400);

    const interests = [...new Set(parsed.data.interests.filter((c) => VALID.has(c)))];
    const saved = await prisma.user
      .update({ where: { id: me.id }, data: { newsInterests: interests }, select: { newsInterests: true } })
      .catch(() => null); // pre-migration: swallow (feature simply not active yet)
    return ok({ interests: saved?.newsInterests ?? interests });
  } catch (err) {
    return handleError(err, "news:interests:save");
  }
}
