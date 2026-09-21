import { prisma } from "@/lib/prisma";
import { NOT_TRASHED } from "@modules/research/lib/post-visibility";
import { ok, handleError } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// GET /api/search/posts?q= - lightweight research-post search for the command
// palette. Public (published only, same exposure as /research), rate-limited,
// cached, and P2021/P2022-safe (returns [] before the DB is migrated).
export async function GET(req: Request) {
  try {
    const q = (new URL(req.url).searchParams.get("q") || "").trim();
    if (q.length < 2) return ok({ results: [] });

    const { success } = await rateLimit("subscribe", clientIp(req)); // reuse a generous IP bucket
    if (!success) return ok({ results: [] });

    const rows = await prisma.post
      .findMany({
        where: {
          published: true,
          // A deleted post must leave search with it.
          ...NOT_TRASHED,
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { excerpt: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { title: true, slug: true, category: true, premium: true },
      })
      .catch(() => []);

    const res = ok({ results: rows });
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=180");
    return res;
  } catch (err) {
    return handleError(err, "search:posts");
  }
}
