-- Short-link backing store for shareable tool results (points-value calculator
-- and future card kinds). Idempotent: safe to run more than once.

CREATE TABLE IF NOT EXISTS "SharedCard" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    CONSTRAINT "SharedCard_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SharedCard_kind_createdAt_idx" ON "SharedCard"("kind", "createdAt");
