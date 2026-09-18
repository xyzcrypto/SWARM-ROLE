-- Soft delete for research posts.
--
-- ⚠️ This exists because `DELETE /api/research/[id]` called `prisma.post.delete`.
-- A published article was gone from Postgres with no way back short of a
-- database backup, and a backup is not a feature - it is a thing you discover
-- you do not have on the day you need it.
--
-- `deletedAt` non-null means "in the trash": hidden from every read path,
-- restorable from the trash view, and purged only by an explicit second action.
--
-- Additive and idempotent, like every migration in this repo: `db push` runs on
-- production deploys only and a failure now fails the build loudly, but a
-- migration that cannot be re-run safely turns one retry into an outage.
--
-- Nullable with no default, so every existing row is "not deleted" already and
-- no backfill is needed.
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Every list query now filters `deletedAt IS NULL` alongside `published`, which
-- is the exact shape this index serves. Partial, so it indexes only the live
-- rows - the trash is small and read by one admin screen.
CREATE INDEX IF NOT EXISTS "Post_live_createdAt_idx"
  ON "Post" ("published", "createdAt")
  WHERE "deletedAt" IS NULL;
