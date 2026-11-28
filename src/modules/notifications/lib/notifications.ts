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
  // ONE statement, done inside the database. This used to load up to 50,000
  // user ids into the function and send them back in up to 100 sequential
  // `createMany` round trips, all while the admin's publish request waited
  // (review M5, 2026-11-28). The cap stays so one publish stays bounded.
  //
  // Ids are "c" + 32 hex chars, so they pass isCuid() like Prisma's own. Time
  // is written as UTC explicitly: the column is `timestamp without time zone`
  // and Prisma stores UTC there, whatever the session's TimeZone is.
  try {
    const sent = await prisma.$executeRaw`
      INSERT INTO "Notification" ("id", "userId", "type", "title", "body", "href", "read", "createdAt")
      SELECT 'c' || replace(gen_random_uuid()::text, '-', ''), u."id", 'new_post', ${"New research published"}::text,
             ${post.title}::text, ${`/research/${post.slug}`}::text, false, (now() AT TIME ZONE 'UTC')
      FROM "User" u
      WHERE u."id" <> ${post.authorId ?? ""}::text
      LIMIT ${NEW_POST_MAX_RECIPIENTS}::int`;
    if (sent > 0) pingClients();
  } catch (err) {
    console.error("[notifications] notifyNewPost failed", err);
  }
}

export const NEW_POST_MAX_RECIPIENTS = 50_000;

/** Read notifications are kept this long. */
export const KEEP_READ_DAYS = 30;
/** Every notification, read or not, is kept at most this long. */
export const KEEP_ANY_DAYS = 90;
/** Rows removed per call, so a first run on a large table stays one short statement. */
export const PRUNE_BATCH = 20_000;

/**
 * Retention for the `Notification` table, which had none: it grew by
 * members x posts for ever (review M5). Deletes read rows older than
 * KEEP_READ_DAYS and any row older than KEEP_ANY_DAYS, at most PRUNE_BATCH per
 * call. Written as `createdAt < 30d AND (read OR createdAt < 90d)`, which is
 * the same set, so the `createdAt` index bounds the scan. Called by the daily
 * cron and after every publish. Never throws; returns rows removed.
 */
export async function pruneNotifications(): Promise<number> {
  try {
    return await prisma.$executeRaw`
      DELETE FROM "Notification" WHERE "id" IN (
        SELECT "id" FROM "Notification"
        WHERE "createdAt" < (now() AT TIME ZONE 'UTC') - make_interval(days => ${KEEP_READ_DAYS}::int)
          AND ("read" = true OR "createdAt" < (now() AT TIME ZONE 'UTC') - make_interval(days => ${KEEP_ANY_DAYS}::int))
        LIMIT ${PRUNE_BATCH}::int
      )`;
  } catch (err) {
    console.error("[notifications] prune failed", err);
    return 0;
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
