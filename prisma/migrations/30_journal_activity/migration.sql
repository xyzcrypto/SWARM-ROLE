-- JournalActivity - a public, aggregate-only log of Journal actions, powering
-- the "Journal Activity" section on public profiles. Idempotent: safe to run
-- more than once.

CREATE TABLE IF NOT EXISTS "JournalActivity" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "win" BOOLEAN,
    "userId" TEXT NOT NULL,
    CONSTRAINT "JournalActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "JournalActivity_userId_createdAt_idx" ON "JournalActivity"("userId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "JournalActivity" ADD CONSTRAINT "JournalActivity_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
