import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ url: z.string().url().max(600) });

// POST /api/news/like — toggle my like on a story. Returns { liked, count }.
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in to like stories.", 401);
    const { success } = await rateLimit("like", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid input.", 400);
    const { url } = parsed.data;

    const existing = await prisma.newsLike.findUnique({
      where: { userId_url: { userId: me.id, url } },
      select: { id: true },
    });
    let liked: boolean;
    if (existing) {
      await prisma.newsLike.delete({ where: { id: existing.id } });
      liked = false;
    } else {
      await prisma.newsLike.create({ data: { url, userId: me.id } });
      liked = true;
    }
    const count = await prisma.newsLike.count({ where: { url } });
    return ok({ liked, count });
  } catch (err) {
    return handleError(err, "news:like");
  }
}
