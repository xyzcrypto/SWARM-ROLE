-- Community Chat: members bookmark messages; bookmarks show on their profile.
--
-- ⚠️ Idempotent throughout (IF NOT EXISTS / DO-blocks), because
-- `scripts/db-push.mjs` retries three times on a production deploy.
-- Additive only: a new table; ChatMessage and User are referenced, not altered.
-- Every read of this table is failure-tolerant, so a preview deploy running
-- against a database that has not been pushed yet shows no bookmarks rather
-- than an error.
CREATE TABLE IF NOT EXISTS "ChatBookmark" (
  "id"        TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId"    TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  CONSTRAINT "ChatBookmark_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ChatBookmark_userId_messageId_key" ON "ChatBookmark"("userId", "messageId");
CREATE INDEX IF NOT EXISTS "ChatBookmark_userId_createdAt_idx" ON "ChatBookmark"("userId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "ChatBookmark" ADD CONSTRAINT "ChatBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ChatBookmark" ADD CONSTRAINT "ChatBookmark_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
