import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, getAdminSession } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { touchLastSeen } from "@/lib/touch-last-seen";
import {
  PRESENCE_WINDOW_MS,
  PRESENCE_PRUNE_CHANCE,
  PRESENCE_PRUNE_OLDER_THAN_MS,
  ROOM_SITE,
} from "@/lib/presence";

/** Most visitors one dashboard will ever need to see at once. */
const ONLINE_LIST_LIMIT = 50;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Site-wide presence, the dependable half of the admin "Live online" number.
 *
 * `POST` - "I am still here", from any page that is NOT `/community` (the chat
 * owns the row there; see `chatOwnsPresence`). Only fires while the Supabase
 * realtime channel is down, so a healthy deployment pays nothing for it.
 *
 * `GET` - admin only. Counts rows touched inside the window, across every room.
 *
 * Why this exists: the dashboard's "Live online" read Supabase Realtime presence
 * and nothing else. When the channel cannot connect - which is its current state
 * - it showed a flat **0** with no retry, no poll, and no hint that its only
 * source was gone. An admin looking at a busy site would have read that as
 * "nobody is here", which is worse than no number at all.
 */
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Sign in required.", 401);

    // Leaving is handled before the limiter: it is a delete of the caller's own
    // single row and it is the thing that prevents ghosts, so a throttled
    // goodbye is worse than no throttle. Same rule as /api/chat/presence.
    const body = await req.json().catch(() => null);
    if (body && typeof body === "object" && (body as { leave?: unknown }).leave === true) {
      // Stamp last-seen BEFORE dropping the presence row. Leaving is the single
      // most informative moment for "last seen" and it is also the moment the
      // row that could have told us disappears, so the two have to happen
      // together. No extra request: the beacon was already being sent.
      await Promise.all([
        touchLastSeen(me.id),
        prisma.chatPresence.deleteMany({ where: { userId: me.id } }).catch(() => null),
      ]);
      return ok({ left: true });
    }

    const { success } = await rateLimit("chatPresence", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    await Promise.all([
      prisma.chatPresence
        .upsert({
          where: { userId: me.id },
          create: { userId: me.id, room: ROOM_SITE, seenAt: new Date() },
          update: { room: ROOM_SITE, seenAt: new Date() },
        })
        .catch(() => null), // a not-yet-migrated DB must not break every page
      touchLastSeen(me.id),
    ]);

    if (Math.random() < PRESENCE_PRUNE_CHANCE) {
      void prisma.chatPresence
        .deleteMany({ where: { seenAt: { lt: new Date(Date.now() - PRESENCE_PRUNE_OLDER_THAN_MS) } } })
        .catch(() => null);
    }

    return ok({ beat: true });
  } catch (err) {
    return handleError(err, "presence:post");
  }
}

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return fail("Unauthorized", 401);

    const since = new Date(Date.now() - PRESENCE_WINDOW_MS);
    // `null` rather than 0 on failure: a missing table is not "nobody online",
    // and the whole point of this route is to stop a broken source reading as a
    // real zero. The client shows "unavailable" for null.
    const online = await prisma.chatPresence
      .count({ where: { seenAt: { gte: since } } })
      .catch(() => null);

    // Who is online, not just how many. Capped so a busy site never ships a
    // thousand rows to one dashboard - and the `online` COUNT above stays the
    // true total regardless, so a truncated list can never read as fewer
    // people being present.
    const visitors = await prisma.chatPresence
      .findMany({
        where: { seenAt: { gte: since } },
        orderBy: { seenAt: "desc" },
        take: ONLINE_LIST_LIMIT,
        select: {
          room: true,
          seenAt: true,
          // Never `email`. Member emails are not exposed anywhere public or
          // admin-facing without a reason, and a presence list has none.
          user: {
            select: { id: true, name: true, username: true, image: true, membership: true, role: true },
          },
        },
      })
      .catch(() => [] as never[]);

    const list = visitors
      .filter((v) => v.user)
      .map((v) => ({
        id: v.user.id,
        name: v.user.name,
        // May be null: a member who never picked a handle has no profile URL,
        // so the client renders them unlinked rather than linking to /u/null.
        username: v.user.username,
        image: v.user.image,
        membership: v.user.membership,
        role: v.user.role,
        room: v.room,
        seenAt: v.seenAt.toISOString(),
      }));

    // Admin-gated and per-request fresh - it must never sit in a shared cache.
    const res = ok({
      online,
      visitors: list,
      truncated: typeof online === "number" && online > list.length,
      source: "server",
      windowMs: PRESENCE_WINDOW_MS,
    });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (err) {
    return handleError(err, "presence:get");
  }
}
