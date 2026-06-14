-- Per-post view counter + self-hosted page-view analytics.
-- Written idempotently (IF NOT EXISTS) so it is safe to apply via
-- `prisma migrate deploy`, `db push`, or by pasting into the Supabase SQL editor
-- even if the column/table were already created out-of-band.

-- Post.views: total article opens, incremented on the research detail page.
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "views" INTEGER NOT NULL DEFAULT 0;

-- PageView: one row per tracked page open (powers admin Total/Today/Live visits).
CREATE TABLE IF NOT EXISTS "PageView" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PageView_createdAt_idx" ON "PageView"("createdAt");
