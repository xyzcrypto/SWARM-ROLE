/**
 * The one definition of "not in the trash".
 *
 * ⚠️ Sixteen places query `Post`. Sixteen hand-written `deletedAt: null` clauses
 * is fifteen chances to forget one - and forgetting one means a deleted article
 * is still reachable by URL, still counted in a total, or still in a sitemap.
 * That failure is silent: nothing errors, the post is simply still there.
 *
 * So the predicate lives here, every read spreads it, and
 * `post-soft-delete.test.ts` fails if a `prisma.post` read appears without it.
 */
export const NOT_TRASHED = { deletedAt: null } as const;

/** Live posts: published and not in the trash. The public list's filter. */
export const LIVE_POST = { published: true, ...NOT_TRASHED } as const;
