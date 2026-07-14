-- Trading Journal (Trading OS Phase 1) - Trade / TradeFill / TradeRevision.
-- Idempotent: safe to run more than once. Cascades when a Trade or its owning
-- User is deleted.

CREATE TABLE IF NOT EXISTS "Trade" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'perp',
    "status" TEXT NOT NULL DEFAULT 'open',
    "platformId" TEXT,
    "leverage" DOUBLE PRECISION DEFAULT 1,
    "stopLoss" DOUBLE PRECISION,
    "takeProfit" DOUBLE PRECISION,
    "setup" TEXT,
    "marketCondition" TEXT,
    "session" TEXT,
    "timeframe" TEXT,
    "assetCategory" TEXT,
    "tags" TEXT[] NOT NULL DEFAULT '{}',
    "emotions" TEXT[] NOT NULL DEFAULT '{}',
    "mistakes" TEXT[] NOT NULL DEFAULT '{}',
    "lessons" TEXT,
    "notes" TEXT,
    "screenshots" TEXT[] NOT NULL DEFAULT '{}',
    "customFields" JSONB,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "userId" TEXT NOT NULL,
    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TradeFill" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "size" DOUBLE PRECISION NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tradeId" TEXT NOT NULL,
    CONSTRAINT "TradeFill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TradeRevision" (
    "id" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diff" JSONB NOT NULL,
    "editedBy" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    CONSTRAINT "TradeRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Trade_userId_createdAt_idx" ON "Trade"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Trade_userId_status_idx" ON "Trade"("userId", "status");
CREATE INDEX IF NOT EXISTS "TradeFill_tradeId_executedAt_idx" ON "TradeFill"("tradeId", "executedAt");
CREATE INDEX IF NOT EXISTS "TradeRevision_tradeId_changedAt_idx" ON "TradeRevision"("tradeId", "changedAt");

DO $$ BEGIN
  ALTER TABLE "Trade" ADD CONSTRAINT "Trade_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TradeFill" ADD CONSTRAINT "TradeFill_tradeId_fkey"
    FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TradeRevision" ADD CONSTRAINT "TradeRevision_tradeId_fkey"
    FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
