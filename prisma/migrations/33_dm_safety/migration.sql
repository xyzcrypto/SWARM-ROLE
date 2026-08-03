-- DM safety: block, report, and a per-user "who can DM me" setting.
--
-- Idempotent: safe to run more than once.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dmPrivacy" TEXT NOT NULL DEFAULT 'everyone';

-- One-way rows, enforced in BOTH directions when messaging: if either side has
-- blocked the other, neither can send. Silencing only one direction would leave
-- the blocker still receiving, which is the thing they asked to stop.
CREATE TABLE IF NOT EXISTS "Block" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Block_blockerId_blockedId_key" ON "Block" ("blockerId", "blockedId");
CREATE INDEX IF NOT EXISTS "Block_blockedId_idx" ON "Block" ("blockedId");

CREATE TABLE IF NOT EXISTS "Report" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "messageId" TEXT,
    "reporterId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Report_status_createdAt_idx" ON "Report" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Report_subjectId_idx" ON "Report" ("subjectId");

DO $$ BEGIN
  ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerId_fkey"
    FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedId_fkey"
    FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Report" ADD CONSTRAINT "Report_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
