-- Trading OS Phase 3 - one optional risk configuration per user. Idempotent:
-- safe to run more than once. Cascades when the owning User is deleted.

CREATE TABLE IF NOT EXISTS "RiskProfile" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountEquity" DOUBLE PRECISION,
    "maxRiskPerTradePct" DOUBLE PRECISION,
    "maxDailyLossPct" DOUBLE PRECISION,
    "maxWeeklyDrawdownPct" DOUBLE PRECISION,
    "maxOpenRiskPct" DOUBLE PRECISION,
    "maxLeverage" DOUBLE PRECISION,
    "maxTradesPerDay" INTEGER,
    "revengeCooldownMinutes" INTEGER DEFAULT 30,
    "userId" TEXT NOT NULL,
    CONSTRAINT "RiskProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RiskProfile_userId_key" ON "RiskProfile"("userId");

DO $$ BEGIN
  ALTER TABLE "RiskProfile" ADD CONSTRAINT "RiskProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
