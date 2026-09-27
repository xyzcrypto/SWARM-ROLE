-- Community Chat: user-submitted reports on chat messages.
--
-- ⚠️ Idempotent throughout (IF NOT EXISTS), because `scripts/db-push.mjs`
-- retries three times on a production deploy and a migration that cannot be
-- re-run safely turns one transient failure into an outage.
--
-- Additive only: no existing table is altered. `ChatMessage` and `User` are
-- referenced, not modified.
CREATE TABLE IF NOT EXISTS "ChatReport" (
  "id"        TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  -- One of the fixed reasons; validated by zod server-side, stored as text so
  -- adding a reason later needs no enum migration.
  "reason"    TEXT NOT NULL,
  -- Optional free text from the reporter, length-capped server-side.
  "details"   TEXT,
  -- "open" | "reviewed" | "dismissed". Staff-only; never returned to the
  -- reporter, who only ever learns that their own report was received.
  "status"    TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatReport_pkey" PRIMARY KEY ("id")
);

-- ⚠️ THE anti-spam guarantee, enforced by the database rather than by a check
-- the client could skip: one report per person per message. A second attempt
-- hits a unique violation, which the route turns into the same success message
-- the first one returned - so a duplicate cannot be used to probe whether a
-- report already exists.
CREATE UNIQUE INDEX IF NOT EXISTS "ChatReport_messageId_userId_key"
  ON "ChatReport" ("messageId", "userId");

-- The moderation queue reads open reports newest-first.
CREATE INDEX IF NOT EXISTS "ChatReport_status_createdAt_idx"
  ON "ChatReport" ("status", "createdAt");

DO $$ BEGIN
  ALTER TABLE "ChatReport" ADD CONSTRAINT "ChatReport_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ChatReport" ADD CONSTRAINT "ChatReport_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
