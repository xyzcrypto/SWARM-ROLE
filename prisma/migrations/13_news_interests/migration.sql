-- Personalized news feed: the categories a member follows. Nullable-safe (has a
-- default), idempotent like all migrations here — safe to re-run via db push.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "newsInterests" TEXT[] NOT NULL DEFAULT '{}';
