-- ChallengeDayNote - a participant's own per-day reflection (note + mood)
-- within a challenge. Day-by-day P&L is never stored here (derived from
-- linked trades instead). Idempotent: safe to run more than once.

CREATE TABLE IF NOT EXISTS "ChallengeDayNote" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "day" TEXT NOT NULL,
    "note" TEXT,
    "mood" TEXT,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "ChallengeDayNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChallengeDayNote_challengeId_userId_day_key" ON "ChallengeDayNote"("challengeId", "userId", "day");
CREATE INDEX IF NOT EXISTS "ChallengeDayNote_challengeId_userId_idx" ON "ChallengeDayNote"("challengeId", "userId");

DO $$ BEGIN
  ALTER TABLE "ChallengeDayNote" ADD CONSTRAINT "ChallengeDayNote_challengeId_fkey"
    FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ChallengeDayNote" ADD CONSTRAINT "ChallengeDayNote_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
