import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { notifyNewComment } from "@/lib/notifications";
import { broadcastEvent } from "@/lib/realtime";
import { stripInlineImage } from "@/lib/utils";

// GET /api/posts/:id/comments - public; visible comments, newest first, paginated.
export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    if (!isCuid(params.id)) return fail("Invalid id.", 400);
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize")) || 20));

    const where = { postId: params.id, status: "visible" };
    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          body: true,
          createdAt: true,
          user: { select: { name: true, username: true, image: true, membership: true } },
        },
      }),
      prisma.comment.count({ where }),
    ]);

    // Expose a display name + public handle/avatar (for linking to /u/<handle>),
    // never the commenter's email. `email` is deliberately NOT selected: this
    // response is unauthenticated and CDN-cached, and the old fallback chain
    // shipped the email local-part as the display name for any user who had
    // never set a name.
    const safe = comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      author: {
        name: c.user?.name || c.user?.username || "Member",
        username: c.user?.username ?? null,
        image: stripInlineImage(c.user?.image),
        premium: c.user?.membership === "Premium",
      },
    }));

    const res = ok({ comments: safe, total, page, pageSize, hasMore: page * pageSize < total });
    res.headers.set("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
    return res;
  } catch (err) {
    return handleError(err, "comments:list");
  }
}

const createSchema = z.object({
  body: z.string().trim().min(1, "Comment can't be empty").max(1000, "Comment is too long"),
});

// POST /api/posts/:id/comments - any logged-in user; auto-published.
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getSessionUser();
    if (!user) return fail("Please log in to comment.", 401);

    // Per authenticated user - can't be bypassed by rotating IPs.
    const { success } = await rateLimit("comment", user.id);
    if (!success) return fail("You're commenting too fast. Please slow down.", 429);

    if (!isCuid(params.id)) return fail("Invalid id.", 400);

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);

    const post = await prisma.post.findUnique({
      where: { id: params.id },
      select: { id: true, published: true, title: true, slug: true, authorId: true },
    });
    if (!post || !post.published) return fail("Post not found.", 404);

    const created = await prisma.comment.create({
      data: { body: parsed.data.body, postId: params.id, userId: user.id },
      select: { id: true, body: true, createdAt: true, user: { select: { name: true, username: true, image: true, membership: true } } },
    });

    // Notify the post author (best-effort, skips self-comments).
    await notifyNewComment({
      postAuthorId: post.authorId,
      commenterId: user.id,
      commenterName: created.user?.name || created.user?.username || "Someone",
      postTitle: post.title,
      postSlug: post.slug,
    });

    // Live: tell everyone viewing this post a new comment landed (they refetch).
    void broadcastEvent(`post:${params.id}`, "comment", { id: created.id });

    return ok(
      {
        comment: {
          id: created.id,
          body: created.body,
          createdAt: created.createdAt,
          author: {
            name: created.user?.name || created.user?.username || "Member",
            username: created.user?.username ?? null,
            image: stripInlineImage(created.user?.image),
            premium: created.user?.membership === "Premium",
          },
        },
      },
      201
    );
  } catch (err) {
    return handleError(err, "comments:create");
  }
}
