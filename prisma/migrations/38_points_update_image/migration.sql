-- A cover image for a points update.
--
-- Additive and idempotent, like every migration in this repo: `db push` runs on
-- production deploys only and a failure now fails the build loudly, but a
-- migration that cannot be re-run safely turns one retry into an outage.
--
-- Nullable with no default, so every existing row stays valid and no backfill
-- is needed. `IF NOT EXISTS` so a re-run is a no-op rather than an error.
ALTER TABLE "PointsUpdate" ADD COLUMN IF NOT EXISTS "image" TEXT;
