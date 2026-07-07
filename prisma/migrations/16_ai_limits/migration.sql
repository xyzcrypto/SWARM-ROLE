-- Per-user daily AI request override (null = use the plan default). Set by the
-- admin AI-usage limit editor. Idempotent (safe to re-run).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "aiDailyLimit" INTEGER;
