// Server-only helpers for creating in-app notifications. Every function here is
// best-effort: a failure (including a missing `Notification` table before the
// migration is applied) is swallowed so it never breaks the action that
// triggered it (publishing a post, posting a comment, etc.).
import { prisma } from "@/lib/prisma";
import { broadcastEvent, CH_NOTIFY } from "@/lib/realtime";
import { extractMentions } from "@shared/utils/mentions";

export type NotificationType = "new_post" | "new_comment" | "mention" | "new_message" | "system";

// Fire a lightweight global "ping" so connected clients refetch their own
// unread count/list in near-real-time. Best-effort (no-op without Supabase).
function pingClients(): void {
  void broadcastEvent(CH_NOTIFY, "ping", { at: Date.now() });
}

type NewNotification = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  href?: string | null;
};

/** Create a single notification for one user. Never throws. */
export async function createNotification(input: NewNotification): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
      },
    });
    pingClients();
  } catch (err) {
    console.error("[notifications] create failed", err);
  }
}

/**
 * Fan a newly published post out to all members (except the author) as in-app
 * notifications. Email is intentionally left dormant for now (the in-app system
 * is the delivery channel until a verified Resend domain is configured).
 */
export async function notifyNewPost(post: {
  title: string;
  slug: string;
  authorId?: string | null;
}): Promise<void> {
  // Cap the fan-out and insert in batches so a large user base can't turn a
  // single publish into one giant query/insert (bounded memory + transaction
  // size). Behavior is identical at small scale.
  const MAX_RECIPIENTS = 50_000;
  const BATCH = 500;
  try {
    const users = await prisma.user.findMany({ select: { id: true }, take: MAX_RECIPIENTS });
    const recipients = users.filter((u) => u.id !== post.authorId);
    if (recipients.length === 0) return;
    for (let i = 0; i < recipients.length; i += BATCH) {
      await prisma.notification.createMany({
        data: recipients.slice(i, i + BATCH).map((u) => ({
          userId: u.id,
          type: "new_post" as const,
          title: "New research published",
          body: post.title,
          href: `/research/${post.slug}`,
        })),
      });
    }
    pingClients();
  } catch (err) {
    console.error("[notifications] notifyNewPost failed", err);
  }
}

/**
 * Tell people they were @mentioned.
 *
 * ⚠️ Until now, NOTHING did. The community room parsed mentions, highlighted
 * them and offered autocomplete for them - and being tagged was still something
 * you found out by scrolling back. DM did not have mentions at all. The
 * `"new_message"` member of `NotificationType` above has been declared since the
 * type was written and is constructed nowhere; every apparent hit for it in the
 * codebase is the realtime broadcast EVENT of the same name, which is a
 * different thing entirely.
 *
 * Resolution is by handle against real users, so `@notauser` notifies nobody
 * rather than silently doing nothing at a layer further down.
 *
 * Best-effort like everything else here: a mention that fails to notify must
 * never take the message with it.
 */
export async function notifyMentions(input: {
  /** Raw message body; handles are extracted from it. */
  body: string;
  /** Who wrote it - never notified about their own message. */
  authorId: string;
  authorName: string;
  /** Where the mention happened, for the notification title. */
  context: "community" | "dm";
  /** Where clicking the notification should land. */
  href: string;
  /** When set, only these user ids may be notified (the two DM participants). */
  restrictToUserIds?: string[];
}): Promise<void> {
  try {
    const handles = extractMentions(input.body);
    if (!handles.length) return;

    const users = await prisma.user.findMany({
      where: { username: { in: handles } },
      select: { id: true },
    });

    let recipients = users.map((u) => u.id).filter((id) => id !== input.authorId);
    // A DM has exactly two participants. Without this, `@someone` in a private
    // thread would notify a third party that they had been mentioned somewhere
    // they cannot open - which leaks that the conversation exists.
    if (input.restrictToUserIds) {
      const allowed = new Set(input.restrictToUserIds);
      recipients = recipients.filter((id) => allowed.has(id));
    }
    if (!recipients.length) return;

    await prisma.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        type: "mention" as const,
        title: `${input.authorName} mentioned you`,
        // The message itself, trimmed. A notification saying only "you were
        // mentioned" makes the reader open the room to find out whether it
        // matters; two lines of the actual message usually answers that.
        body: input.body.length > 140 ? `${input.body.slice(0, 139)}\u2026` : input.body,
        href: input.href,
      })),
    });
    pingClients();
  } catch (err) {
    console.error("[notifications] notifyMentions failed", err);
  }
}

/** Notify a post's author that someone commented (skips self-comments). */
export async function notifyNewComment(input: {
  postAuthorId?: string | null;
  commenterId: string;
  commenterName: string;
  postTitle: string;
  postSlug: string;
}): Promise<void> {
  if (!input.postAuthorId || input.postAuthorId === input.commenterId) return;
  await createNotification({
    userId: input.postAuthorId,
    type: "new_comment",
    title: `${input.commenterName} commented on your post`,
    body: input.postTitle,
    href: `/research/${input.postSlug}`,
  });
}
