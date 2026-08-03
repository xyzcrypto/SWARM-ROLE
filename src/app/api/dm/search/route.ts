import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { publicImageUrl } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/dm/search?q= - find members to start a DM with (by name or @username).
// Logged-in + rate-limited. Returns public profile fields only, excludes self and
// users without a username. Empty q returns a few recent members.
export async function GET(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);

    const { success } = await rateLimit("comment", me.id);
    if (!success) return fail("Slow down a moment.", 429);

    const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 60);
    const where: Prisma.UserWhereInput = {
      id: { not: me.id },
      username: { not: null },
      ...(q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }] }
        : {}),
    };

    const rows = await prisma.user
      .findMany({ where, take: 12, orderBy: { createdAt: "desc" }, select: { id: true, name: true, username: true, image: true } })
      .catch(() => [] as { id: string; name: string | null; username: string | null; image: string | null }[]);

    return ok({ users: rows.filter((u) => u.username).map((u) => ({ ...u, image: publicImageUrl(u.image, u.id) })) });
  } catch (err) {
    return handleError(err, "dm:search");
  }
}
