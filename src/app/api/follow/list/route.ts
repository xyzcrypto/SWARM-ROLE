import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/follow/list?username=<u>&type=followers|following
// Returns the follower/following users for a profile, each flagged with whether
// the VIEWER already follows them (so the list can show Follow/Following buttons).
// Resilient before the Follow table is migrated (empty list).
export async function GET(req: Request) {
  try {
    const me = await getSessionUser().catch(() => null);
    const sp = new URL(req.url).searchParams;
    const username = sp.get("username")?.trim().toLowerCase() ?? "";
    const type = sp.get("type") === "following" ? "following" : "followers";
    if (!username) return fail("No user specified.", 400);

    const target = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!target) return fail("User not found.", 404);

    const userSelect = { id: true, name: true, username: true, image: true, bio: true } as const;
    const rows = await prisma.follow
      .findMany({
        where: type === "followers" ? { followingId: target.id } : { followerId: target.id },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: type === "followers" ? { follower: { select: userSelect } } : { following: { select: userSelect } },
      })
      .catch(() => [] as any[]);

    const users = rows
      .map((r: any) => (type === "followers" ? r.follower : r.following))
      .filter((u: any) => u && u.username);

    // Mark which of these the viewer already follows.
    let mine = new Set<string>();
    if (me && users.length) {
      const ids = users.map((u: any) => u.id);
      const fr = await prisma.follow
        .findMany({ where: { followerId: me.id, followingId: { in: ids } }, select: { followingId: true } })
        .catch(() => [] as { followingId: string }[]);
      mine = new Set(fr.map((f) => f.followingId));
    }

    const list = users.map((u: any) => ({
      name: u.name,
      username: u.username,
      image: u.image,
      bio: u.bio ? String(u.bio).slice(0, 80) : null,
      isFollowing: mine.has(u.id),
      isMe: me?.id === u.id,
    }));

    return ok({ list });
  } catch (err) {
    return handleError(err, "follow:list");
  }
}
