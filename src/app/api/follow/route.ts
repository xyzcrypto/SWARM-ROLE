import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { broadcastEvent, userChannel } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/follow?username=... - the viewer's follow state + live follower
// count for a profile. Resilient before the Follow table is migrated (0 / false).
export async function GET(req: Request) {
  try {
    const me = await getSessionUser().catch(() => null);
    const username = new URL(req.url).searchParams.get("username")?.trim().toLowerCase() ?? "";
    if (!username) return fail("No user specified.", 400);
    const target = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!target) return fail("User not found.", 404);

    const followers = await prisma.follow.count({ where: { followingId: target.id } }).catch(() => 0);
    let following = false;
    if (me && me.id !== target.id) {
      const row = await prisma.follow
        .findUnique({ where: { followerId_followingId: { followerId: me.id, followingId: target.id } }, select: { id: true } })
        .catch(() => null);
      following = !!row;
    }
    return ok({ followers, following });
  } catch (err) {
    return handleError(err, "follow:get");
  }
}

// POST /api/follow { username } - toggle follow / unfollow the target user.
// Returns the new state + live follower count. Logged-in + rate-limited.
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in to follow.", 401);

    const { success } = await rateLimit("comment", me.id);
    if (!success) return fail("Slow down a moment.", 429);

    const body = await req.json().catch(() => null);
    const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
    if (!username) return fail("No user specified.", 400);

    const target = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true },
    });
    if (!target) return fail("User not found.", 404);
    if (target.id === me.id) return fail("You can't follow yourself.", 400);

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: me.id, followingId: target.id } },
      select: { id: true },
    });

    let following: boolean;
    if (existing) {
      await prisma.follow.delete({ where: { id: existing.id } });
      following = false;
    } else {
      await prisma.follow.create({ data: { followerId: me.id, followingId: target.id } });
      following = true;
    }

    const followers = await prisma.follow.count({ where: { followingId: target.id } });

    // Live: nudge the target's channel so any open profile updates the count.
    void broadcastEvent(userChannel(target.id), "follow", { followers, actorId: me.id, following });

    // Best-effort in-app notification on a NEW follow.
    if (following) {
      const meName = (me as { name?: string | null }).name || "Someone";
      const meUsername = (me as { username?: string | null }).username;
      void prisma.notification
        .create({
          data: {
            userId: target.id,
            type: "system",
            title: `${meName} started following you`,
            href: meUsername ? `/u/${meUsername}` : "/",
          },
        })
        .catch(() => {});
    }

    return ok({ following, followers });
  } catch (err) {
    return handleError(err, "follow");
  }
}
