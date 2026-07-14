-- Basic engagement XP system - XpEvent (one row per user/action/day, unique
-- constraint makes awarding idempotent) plus a denormalized User.xp counter.
-- Idempotent: safe to run more than once.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "xp" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "XpEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 1,
    "userId" TEXT NOT NULL,
    CONSTRAINT "XpEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "XpEvent_userId_action_day_key" ON "XpEvent"("userId", "action", "day");
CREATE INDEX IF NOT EXISTS "XpEvent_userId_createdAt_idx" ON "XpEvent"("userId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "XpEvent" ADD CONSTRAINT "XpEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
