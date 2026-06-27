-- Milestone 2: granular staff permissions + What's New CMS + admin audit trail.
-- Written idempotently (IF NOT EXISTS) so it is safe to apply via
-- `prisma migrate deploy`, `prisma db push`, or by pasting into the Supabase SQL
-- editor even if the column/tables were already created out-of-band.

-- Granular staff capabilities (catalog in src/lib/permissions.ts).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "permissions" TEXT[] NOT NULL DEFAULT '{}';

-- "What's New" feed (admin-managed + auto on research publish).
CREATE TABLE IF NOT EXISTS "WhatsNewEntry" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tag" TEXT NOT NULL DEFAULT 'New',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postId" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsNewEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WhatsNewEntry_published_date_idx" ON "WhatsNewEntry"("published", "date");
CREATE INDEX IF NOT EXISTS "WhatsNewEntry_tag_date_idx" ON "WhatsNewEntry"("tag", "date");

-- Append-only audit trail for sensitive admin actions (role/permission grants).
CREATE TABLE IF NOT EXISTS "AdminAudit" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdminAudit_createdAt_idx" ON "AdminAudit"("createdAt");

-- FK for the audit actor (guarded — ADD CONSTRAINT IF NOT EXISTS isn't supported
-- for foreign keys on all Postgres versions, so swallow the duplicate).
DO $$ BEGIN
  ALTER TABLE "AdminAudit" ADD CONSTRAINT "AdminAudit_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
