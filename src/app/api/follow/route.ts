import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { broadcastEvent, userChannel } from "@/lib/realtime";
import { sendPush, pushEnabled } from "@/lib/push";

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

    // `followingCount` (how many people this profile follows) was never
    // returned, so the client had no way to refresh it - the "Following" number
    // stayed frozen at whatever the server rendered. Unfollow someone from the
    // list and the count sat there unchanged, which is the reported bug.
    //
    // All three are independent, so they run together rather than as serial
    // round trips - the previous version awaited the follower count and then
    // the viewer's follow row one after the other.
    const [followers, followingCount, row] = await Promise.all([
      prisma.follow.count({ where: { followingId: target.id } }).catch(() => 0),
      prisma.follow.count({ where: { followerId: target.id } }).catch(() => 0),
      me && me.id !== target.id
        ? prisma.follow
            .findUnique({
              where: { followerId_followingId: { followerId: me.id, followingId: target.id } },
              select: { id: true },
            })
            .catch(() => null)
        : Promise.resolve(null),
    ]);
    return ok({ followers, followingCount, following: !!row });
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

    // Both counts, in parallel. `myFollowingCount` is how many people the
    // ACTOR now follows - the number on their own profile, which is the one
    // that moves when you unfollow from the followers/following list and the
    // one that had no way of ever being refreshed.
    const [followers, myFollowingCount] = await Promise.all([
      prisma.follow.count({ where: { followingId: target.id } }),
      prisma.follow.count({ where: { followerId: me.id } }).catch(() => 0),
    ]);

    // Live: nudge BOTH channels. The target's, so anyone looking at their
    // profile sees the follower count move; and the actor's own, so their
    // profile open in another tab updates its Following count too - previously
    // only the target was told, so your own number went stale on every other
    // device you had open.
    void broadcastEvent(userChannel(target.id), "follow", { followers, actorId: me.id, following });
    void broadcastEvent(userChannel(me.id), "follow", { followingCount: myFollowingCount, actorId: me.id });

    // Best-effort notifications on a NEW follow (in-app bell + external phone
    // push - always on, no opt-in UI, gated only on VAPID being configured).
    if (following) {
      const meName = (me as { name?: string | null }).name || "Someone";
      const meUsername = (me as { username?: string | null }).username;
      const href = meUsername ? `/u/${meUsername}` : "/";

      void prisma.notification
        .create({ data: { userId: target.id, type: "system", title: `${meName} started following you`, href } })
        .catch(() => {});

      if (pushEnabled) {
        void (async () => {
          const subs = await prisma.pushSubscription.findMany({ where: { userId: target.id }, select: { endpoint: true, p256dh: true, auth: true } }).catch(() => []);
          if (!subs.length) return;
          const payload = { title: "👤 New follower", body: `${meName} started following you`, url: href, tag: `follow-${me.id}` };
          const results = await Promise.all(subs.map((s) => sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload)));
          const gone = subs.filter((_, i) => results[i] === "gone").map((s) => s.endpoint);
          if (gone.length) await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: gone } } }).catch(() => {});
        })();
      }
    }

    return ok({ following, followers });
  } catch (err) {
    return handleError(err, "follow");
  }
}
