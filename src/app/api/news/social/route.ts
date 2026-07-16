import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/news/social?url=… — like count + whether I liked + the comment thread.
// Polled once per story card on /news (high anonymous traffic). For a signed-out
// visitor `liked`/`mine` are always false regardless of who's asking, so that
// response is identical across every anonymous visitor and safe to cache
// publicly at the edge - cutting repeat function invocations for the same
// story to once per cache window instead of once per anonymous pageview.
// Logged-in responses stay `private, no-store` since they're genuinely
// per-viewer (their own like/comment-ownership state).
export async function GET(req: Request) {
  try {
    const url = new URL(req.url).searchParams.get("url") || "";
    if (!url) return fail("Missing url.", 400);
    const me = await getSessionUser();

    const [likes, liked, rows] = await Promise.all([
      prisma.newsLike.count({ where: { url } }).catch(() => 0),
      me ? prisma.newsLike.findUnique({ where: { userId_url: { userId: me.id, url } }, select: { id: true } }).catch(() => null) : Promise.resolve(null),
      prisma.newsComment
        .findMany({
          where: { url, status: "visible" },
          orderBy: { createdAt: "desc" },
          take: 100,
          include: { user: { select: { name: true, username: true, image: true } } },
        })
        .catch(() => [] as any[]),
    ]);

    const comments = rows.map((c: any) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      name: c.user?.name || c.user?.username || "Member",
      username: c.user?.username ?? null,
      image: c.user?.image ?? null,
      mine: me ? c.userId === me.id : false,
    }));

    return NextResponse.json(
      { likes, liked: Boolean(liked), comments },
      { headers: { "Cache-Control": me ? "private, no-store" : "public, s-maxage=15, stale-while-revalidate=60" } }
    );
  } catch (err) {
    return handleError(err, "news:social:get");
  }
}

const commentSchema = z.object({
  url: z.string().url().max(600),
  body: z.string().trim().min(1).max(1000),
});

// POST /api/news/social — add a comment to a story.
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in to comment.", 401);
    const { success } = await rateLimit("comment", me.id);
    if (!success) return fail("You're commenting too fast. Please slow down.", 429);

    const parsed = commentSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.", 400);

    const c = await prisma.newsComment.create({
      data: { url: parsed.data.url, body: parsed.data.body, userId: me.id },
      include: { user: { select: { name: true, username: true, image: true } } },
    });
    return ok({
      comment: {
        id: c.id, body: c.body, createdAt: c.createdAt,
        name: c.user?.name || c.user?.username || "Member",
        username: c.user?.username ?? null, image: c.user?.image ?? null, mine: true,
      },
    });
  } catch (err) {
    return handleError(err, "news:social:post");
  }
}

// DELETE /api/news/social?id=… — remove my own comment.
export async function DELETE(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!id) return fail("Missing id.", 400);
    await prisma.newsComment.deleteMany({ where: { id, userId: me.id } });
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err, "news:social:delete");
  }
}
