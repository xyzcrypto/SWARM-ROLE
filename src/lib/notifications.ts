// Server-only helpers for creating in-app notifications. Every function here is
// best-effort: a failure (including a missing `Notification` table before the
// migration is applied) is swallowed so it never breaks the action that
// triggered it (publishing a post, posting a comment, etc.).
import { prisma } from "@/lib/prisma";
import { broadcastEvent, CH_NOTIFY } from "@/lib/realtime";

export type NotificationType = "new_post" | "new_comment" | "new_message" | "system";

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
