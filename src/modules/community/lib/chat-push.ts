// Chat push notifications - reuses the existing web-push (VAPID) infra that
// powers news alerts. Best-effort + fully gated: no-op when push isn't
// configured, never throws, never blocks the send response.
//
// Anti-spam: we do NOT push on every message (that would buzz phones nonstop in
// a busy room). Instead we ping only when a message *breaks a lull* - i.e. the
// previous message was more than QUIET_WINDOW_MS ago. Combined with a fixed
// notification `tag` (so pings collapse into one), members get a gentle "the
// lounge is active again" nudge that brings them back without spamming.
import { prisma } from "@/lib/prisma";
import { sendPush, pushEnabled } from "@/lib/push";

const QUIET_WINDOW_MS = 5 * 60 * 1000; // 5 min of silence → the next message pings
const BODY_MAX = 120;

type Created = {
  id: string;
  body: string;
  createdAt: Date;
  userId: string | null;
  user?: { name: string | null } | null;
};

/** Fire-and-forget: notify subscribed members that the lounge is active again. */
export async function dispatchChatPush(created: Created): Promise<void> {
  if (!pushEnabled) return;
  try {
    // Only ping when this message breaks a quiet spell (anti-spam).
    const prev = await prisma.chatMessage
      .findFirst({
        where: { status: "visible", id: { not: created.id } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      })
      .catch(() => null);
    if (prev && created.createdAt.getTime() - prev.createdAt.getTime() < QUIET_WINDOW_MS) {
      return; // active burst - don't notify
    }

    // Everyone who opted into notifications, except the sender's own devices.
    const subs = await prisma.pushSubscription
      .findMany({
        where: created.userId ? { userId: { not: created.userId } } : {},
        select: { endpoint: true, p256dh: true, auth: true },
      })
      .catch(() => []);
    if (!subs.length) return;

    const name = created.user?.name?.trim() || "Someone";
    const body = created.body.length > BODY_MAX ? created.body.slice(0, BODY_MAX - 1) + "…" : created.body;
    const payload = {
      title: "💬 XYZ Lounge",
      body: `${name}: ${body}`,
      url: "/community",
      tag: "community-chat", // collapse repeat pings into one notification
    };

    const results = await Promise.all(
      subs.map((s) => sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload))
    );

    // Prune dead endpoints (same as the news dispatcher).
    const gone = subs.filter((_, i) => results[i] === "gone").map((s) => s.endpoint);
    if (gone.length) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: gone } } }).catch(() => {});
    }
  } catch {
    /* best-effort - never break the send */
  }
}
