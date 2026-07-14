-- Trading OS Phase 4 - Challenge / ChallengeParticipant / ChallengeMilestone,
-- plus a Trade.challengeId link column. Idempotent: safe to run more than once.

CREATE TABLE IF NOT EXISTS "Challenge" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "startingCapital" DOUBLE PRECISION NOT NULL,
    "targetCapital" DOUBLE PRECISION,
    "maxRiskPerTradePct" DOUBLE PRECISION,
    "maxDailyLossPct" DOUBLE PRECISION,
    "maxWeeklyDrawdownPct" DOUBLE PRECISION,
    "customRules" TEXT[] NOT NULL DEFAULT '{}',
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "status" TEXT NOT NULL DEFAULT 'active',
    "creatorId" TEXT NOT NULL,
    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChallengeParticipant" (
    "id" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" TEXT NOT NULL DEFAULT 'participant',
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "ChallengeParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChallengeMilestone" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "label" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3),
    "achieved" BOOLEAN NOT NULL DEFAULT false,
    "achievedAt" TIMESTAMP(3),
    "challengeId" TEXT NOT NULL,
    CONSTRAINT "ChallengeMilestone_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "challengeId" TEXT;

CREATE INDEX IF NOT EXISTS "Challenge_creatorId_createdAt_idx" ON "Challenge"("creatorId", "createdAt");
CREATE INDEX IF NOT EXISTS "Challenge_visibility_status_idx" ON "Challenge"("visibility", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "ChallengeParticipant_challengeId_userId_key" ON "ChallengeParticipant"("challengeId", "userId");
CREATE INDEX IF NOT EXISTS "ChallengeParticipant_userId_idx" ON "ChallengeParticipant"("userId");
CREATE INDEX IF NOT EXISTS "ChallengeMilestone_challengeId_idx" ON "ChallengeMilestone"("challengeId");
CREATE INDEX IF NOT EXISTS "Trade_challengeId_idx" ON "Trade"("challengeId");

DO $$ BEGIN
  ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_creatorId_fkey"
    FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ChallengeParticipant" ADD CONSTRAINT "ChallengeParticipant_challengeId_fkey"
    FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ChallengeParticipant" ADD CONSTRAINT "ChallengeParticipant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ChallengeMilestone" ADD CONSTRAINT "ChallengeMilestone_challengeId_fkey"
    FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Trade" ADD CONSTRAINT "Trade_challengeId_fkey"
    FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
