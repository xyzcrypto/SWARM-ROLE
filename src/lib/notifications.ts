// Server-only helpers for creating in-app notifications. Every function here is
// best-effort: a failure (including a missing `Notification` table before the
// migration is applied) is swallowed so it never breaks the action that
// triggered it (publishing a post, posting a comment, etc.).
import { prisma } from "@/lib/prisma";

export type NotificationType = "new_post" | "new_comment" | "new_message" | "system";

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
  try {
    const users = await prisma.user.findMany({ select: { id: true } });
    const recipients = users.filter((u) => u.id !== post.authorId);
    if (recipients.length === 0) return;
    await prisma.notification.createMany({
      data: recipients.map((u) => ({
        userId: u.id,
        type: "new_post" as const,
        title: "New research published",
        body: post.title,
        href: `/research/${post.slug}`,
      })),
    });
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
