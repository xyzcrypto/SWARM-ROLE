-- Notification preferences per push subscription (Web3 News customization).
-- Idempotent: safe to run more than once. Existing rows default to "high"
-- (all high-impact), preserving prior behavior.
ALTER TABLE "PushSubscription" ADD COLUMN IF NOT EXISTS "notifyMode" TEXT NOT NULL DEFAULT 'high';
ALTER TABLE "PushSubscription" ADD COLUMN IF NOT EXISTS "notifyCategories" TEXT[] NOT NULL DEFAULT '{}';
