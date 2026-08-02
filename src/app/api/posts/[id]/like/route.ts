import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { broadcastEvent } from "@/lib/realtime";

// GET /api/posts/:id/like - the CALLER's own liked state. Self-correction for
// a logged-in user after an ISR-cached page load (research/[slug] no longer
// computes per-visitor `myLike` for free posts, so the baked-in initialLiked
// may not be theirs). Guests always correctly show false, no request needed.
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getSessionUser();
    if (!user) return ok({ liked: false });
    if (!isCuid(params.id)) return fail("Invalid id.", 400);
    const existing = await prisma.postLike.findUnique({
      where: { postId_userId: { postId: params.id, userId: user.id } },
      select: { id: true },
    });
    return ok({ liked: Boolean(existing) });
  } catch (err) {
    return handleError(err, "like:status");
  }
}

// POST /api/posts/:id/like - logged-in toggle. Returns { liked, count }.
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getSessionUser();
    if (!user) return fail("Please log in to like posts.", 401);

    // Rate-limit per authenticated user (not IP) - an authed user must not be
    // able to bypass the limit by rotating IPs.
    const { success } = await rateLimit("like", user.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    if (!isCuid(params.id)) return fail("Invalid id.", 400);

    // Independent lookups - "does this post exist and is it published" and
    // "has this user already liked it" do not depend on each other, so they run
    // together rather than costing two serial round trips to Mumbai. The gate
    // below is unchanged: a like is still only written after the post check
    // passes, so fetching `existing` early cannot leak or write anything.
    const [post, existing] = await Promise.all([
      prisma.post.findUnique({
        where: { id: params.id },
        select: { id: true, published: true },
      }),
      prisma.postLike.findUnique({
        where: { postId_userId: { postId: params.id, userId: user.id } },
        select: { id: true },
      }),
    ]);
    if (!post || !post.published) return fail("Post not found.", 404);

    let liked: boolean;
    if (existing) {
      await prisma.postLike.delete({ where: { id: existing.id } });
      liked = false;
    } else {
      await prisma.postLike.create({ data: { postId: params.id, userId: user.id } });
      liked = true;
    }

    const count = await prisma.postLike.count({ where: { postId: params.id } });
    // Live count for everyone viewing this post (best-effort; no-op without realtime).
    void broadcastEvent(`post:${params.id}`, "like", { count, postId: params.id });
    return ok({ liked, count });
  } catch (err) {
    return handleError(err, "like:toggle");
  }
}
