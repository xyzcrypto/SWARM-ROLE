import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, requirePermission } from "@/lib/api";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

// GET /api/comments - global comment list for the dashboard moderation queue
// (post:manage). Filter with ?status=visible|hidden|all; cursor-paginated,
// newest first. Author emails are NOT included (name/handle only).
export async function GET(req: Request) {
  try {
    const actor = await requirePermission("post:manage");
    if (!actor) return fail("Forbidden", 403);

    const params = new URL(req.url).searchParams;
    const statusParam = params.get("status") ?? "all";
    const status = ["visible", "hidden"].includes(statusParam) ? statusParam : undefined;
    const cursor = params.get("cursor");

    const rows = await prisma.comment.findMany({
      where: status ? { status } : {},
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        body: true,
        status: true,
        createdAt: true,
        user: { select: { name: true, username: true } },
        post: { select: { title: true, slug: true } },
      },
    });
    const hasMore = rows.length > PAGE_SIZE;
    const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

    return ok({
      comments: page.map((c) => ({
        id: c.id,
        body: c.body,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        authorName: c.user.name ?? (c.user.username ? `@${c.user.username}` : "Member"),
        postTitle: c.post.title,
        postSlug: c.post.slug,
      })),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    });
  } catch (err) {
    return handleError(err, "comments:list");
  }
}
