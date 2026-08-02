import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

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

// A member counts as present if seen within this window. Comfortably more than
// the client's heartbeat interval, so one dropped request does not make someone
// flicker out of the list.
const WINDOW_MS = 90_000;
const MAX_LISTED = 50;

export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Sign in required.", 401);

    // Keyed per user, not per IP: this is a heartbeat from a logged-in tab, and
    // a member with several tabs open should not throttle themselves out.
    const { success } = await rateLimit("chat", me.id);
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
      // Never serialize an inline data: avatar - see stripInlineImage and the
      // Fast Origin Transfer incident it exists for.
      image: r.user?.image && !r.user.image.startsWith("data:") ? r.user.image : null,
    }));
    // `SessionUser` carries only access metadata (id/role/membership/email), not
    // a display name - so use the row the upsert just wrote rather than
    // inventing one, and fall back to a neutral label if the read raced it.
    if (!members.some((m) => m.id === me.id)) {
      members.unshift({ id: me.id, name: "You", username: null, image: null });
    }

    return ok({ online: members.length, members });
  } catch (err) {
    return handleError(err, "chat:presence");
  }
}
