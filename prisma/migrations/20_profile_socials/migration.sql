-- Milestone: additional public-profile social links (Discord / YouTube /
-- LinkedIn / Instagram). Written idempotently (IF NOT EXISTS) so it is safe to
-- apply via `prisma migrate deploy`, `prisma db push`, or by pasting into the
-- Supabase SQL editor even if the columns were already created out-of-band.
-- All nullable, so existing rows are unaffected and the app degrades gracefully
-- (profile/settings read these columns through a guarded query) until applied.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "discord" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "youtube" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "linkedin" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "instagram" TEXT;
