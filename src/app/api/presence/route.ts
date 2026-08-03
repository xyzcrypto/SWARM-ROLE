import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, getAdminSession } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import {
  PRESENCE_WINDOW_MS,
  PRESENCE_PRUNE_CHANCE,
  PRESENCE_PRUNE_OLDER_THAN_MS,
  ROOM_SITE,
} from "@/lib/presence";

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
      await prisma.chatPresence.deleteMany({ where: { userId: me.id } }).catch(() => null);
      return ok({ left: true });
    }

    const { success } = await rateLimit("chatPresence", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    await prisma.chatPresence
      .upsert({
        where: { userId: me.id },
        create: { userId: me.id, room: ROOM_SITE, seenAt: new Date() },
        update: { room: ROOM_SITE, seenAt: new Date() },
      })
      .catch(() => null); // a not-yet-migrated DB must not break every page

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

    // Admin-gated and per-request fresh - it must never sit in a shared cache.
    const res = ok({ online, source: "server", windowMs: PRESENCE_WINDOW_MS });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (err) {
    return handleError(err, "presence:get");
  }
}
