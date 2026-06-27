-- Milestone 1: brute-force account lockout columns on User.
-- Written idempotently (IF NOT EXISTS) so it is safe to apply via
-- `prisma migrate deploy`, `prisma db push`, or by pasting into the Supabase SQL
-- editor even if the columns were already created out-of-band.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);
