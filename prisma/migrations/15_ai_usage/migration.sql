-- AI usage log: one row per gateway call (metadata only, never prompt/response
-- text). Powers per-user daily limits, the admin AI dashboard and cost tracking.
-- Idempotent (safe to re-run via db push / vercel-build), like all migrations here.

CREATE TABLE IF NOT EXISTS "AiUsage" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "task" TEXT NOT NULL,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "latencyMs" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "errorKind" TEXT,
  "estCostUsdMicros" INTEGER NOT NULL DEFAULT 0,
  "cached" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiUsage_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AiUsage_createdAt_idx" ON "AiUsage"("createdAt");
CREATE INDEX IF NOT EXISTS "AiUsage_userId_createdAt_idx" ON "AiUsage"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiUsage_provider_createdAt_idx" ON "AiUsage"("provider", "createdAt");
