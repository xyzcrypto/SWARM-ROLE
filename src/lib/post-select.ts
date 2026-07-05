import type { Prisma } from "@prisma/client";

// Shared Prisma selection for post cards / lists. It deliberately OMITS the AI
// `summary` column so these queries keep working before the `12_post_summary`
// migration lands — selecting a not-yet-existing column throws P2022, which was
// silently emptying the research grid, the homepage preview and related posts
// (their `.catch(() => [])`), i.e. "Nothing here yet" even with posts present.
// Only the article detail page + the summarize endpoint read/write `summary`.
export const POST_CARD_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  content: true, // stripped before it leaves the server; used for reading time
  cover: true,
  category: true,
  tags: true,
  published: true,
  premium: true,
  views: true,
  createdAt: true,
  updatedAt: true,
  authorId: true,
  author: { select: { name: true } },
} satisfies Prisma.PostSelect;
