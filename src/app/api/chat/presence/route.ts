import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { publicImageUrl } from "@/lib/utils";

// POST /api/chat/presence - "I am still here", and tell me who else is.
//
// Why this exists: the room's online count came only from Supabase Realtime
// presence, so whenever the realtime channel failed to connect the count read 0
// while the room was full. Presence over a WebSocket is the nice path; this is
// the one that always works.
//
// One heartbeat both writes and reads, so a client costs a single request per
// interval rather than two. `private, no-store` because the member list is
// personalised to what the caller is allowed to see and must never sit in a
// shared cache.
export const dynamic = "force-dynamic";

// A member counts as present if seen within this window.
//
// This was 90s against a 45s heartbeat and, critically, there was no "leave"
// signal at all - so closing the tab left you listed as online for up to a
// minute and a half. That is the "person offline hone ke baad bhi online dikh
// raha hai" report: the count was not fake, it was stale.
//
// Now a clean exit deletes the row immediately (see the leave beacon below), so
// this window only has to cover the cases that cannot say goodbye: a crash,
// a killed tab, a dropped network. 60s against a 25s heartbeat means two
// missed beats before someone disappears, which absorbs a transient blip
// without leaving a ghost for long.
const WINDOW_MS = 60_000;
const MAX_LISTED = 50;
// Rows for people who left long ago are dead weight. Pruned opportunistically
// on a small fraction of reads rather than on a cron - same trick /api/track
// uses for pageView retention, and it keeps the table bounded without adding a
// scheduled job on a plan that has none.
const PRUNE_CHANCE = 0.02;
const PRUNE_OLDER_THAN_MS = 30 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Sign in required.", 401);

    // "I'm leaving" - sent by navigator.sendBeacon as the tab closes or is
    // hidden. Handled before the rate limiter on purpose: it is a delete of the
    // caller's own single row, it is the thing that prevents ghosts, and a
    // throttled goodbye is worse than no throttle at all.
    const body = await req.json().catch(() => null);
    if (body && typeof body === "object" && (body as { leave?: unknown }).leave === true) {
      await prisma.chatPresence.deleteMany({ where: { userId: me.id } }).catch(() => null);
      return ok({ left: true });
    }

    // Keyed per user, not per IP: this is a heartbeat from a logged-in tab, and
    // a member with several tabs open should not throttle themselves out.
    //
    // `chatPresence`, NOT `chat`. This used to share the send bucket (10/min),
    // so the unattended beat - every 25s, plus one on every tab wake, and it
    // only runs at all when realtime is down - was spending a third of the
    // budget a member needs for actually writing messages. Typing normally in a
    // room with a dead socket could then return "Too many requests", which reads
    // as the chat being broken.
    const { success } = await rateLimit("chatPresence", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const room = "community";
    const since = new Date(Date.now() - WINDOW_MS);

    // Upsert my own heartbeat, then read the room. Independent of each other -
    // my row does not need to exist before the read counts it, because the read
    // includes me explicitly below - so they run together rather than as two
    // serial round trips.
    const [, rows] = await Promise.all([
      prisma.chatPresence
        .upsert({
          where: { userId: me.id },
          create: { userId: me.id, room, seenAt: new Date() },
          update: { room, seenAt: new Date() },
        })
        .catch(() => null), // a not-yet-migrated DB must not break the room
      prisma.chatPresence
        .findMany({
          where: { room, seenAt: { gte: since } },
          orderBy: { seenAt: "desc" },
          take: MAX_LISTED,
          select: {
            userId: true,
            user: { select: { name: true, username: true, image: true } },
          },
        })
        .catch(() => [] as never[]),
    ]);

    // Fold myself in: the read above may have raced my own upsert, and a room
    // that does not list the person looking at it reads as broken.
    const members = rows.map((r) => ({
      id: r.userId,
      name: r.user?.name ?? "Member",
      username: r.user?.username ?? null,
      // Never serialize an inline data: avatar into this payload - see
      // publicImageUrl and the Fast Origin Transfer incident it exists for.
      // It used to be dropped to null here, which is why members with an
      // uploaded photo showed initials in the online list; it is now a real
      // CDN-cacheable URL instead.
      image: publicImageUrl(r.user?.image, r.userId),
    }));
    // `SessionUser` carries only access metadata (id/role/membership/email), not
    // a display name - so use the row the upsert just wrote rather than
    // inventing one, and fall back to a neutral label if the read raced it.
    if (!members.some((m) => m.id === me.id)) {
      members.unshift({ id: me.id, name: "You", username: null, image: null });
    }

    // Opportunistic prune, never awaited - a retention sweep must not add
    // latency to the room's presence tick.
    if (Math.random() < PRUNE_CHANCE) {
      void prisma.chatPresence
        .deleteMany({ where: { seenAt: { lt: new Date(Date.now() - PRUNE_OLDER_THAN_MS) } } })
        .catch(() => null);
    }

    return ok({ online: members.length, members });
  } catch (err) {
    return handleError(err, "chat:presence");
  }
}
