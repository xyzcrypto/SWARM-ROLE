-- DMs: one emoji reaction per participant per message.
--
-- ⚠️ Idempotent (IF NOT EXISTS), because `scripts/db-push.mjs` retries three
-- times on a production deploy and a migration that cannot be re-run safely
-- turns one transient failure into an outage.
--
-- Additive and nullable: existing rows need no backfill, and code that does
-- not know about the columns keeps working. The thread GET also reads these in
-- a separate, failure-tolerant query, so a preview deploy running against a
-- database that has not been pushed yet shows no reactions rather than 503.
ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "reactionA" TEXT;
ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "reactionB" TEXT;
