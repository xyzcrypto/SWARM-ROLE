-- Perp DEX / airdrop updates shown on /points.
--
-- Additive and idempotent, like every migration in this repo: `db push` runs on
-- production deploys only and a failure now fails the build loudly, but a
-- migration that cannot be re-run safely turns one retry into an outage.
CREATE TABLE IF NOT EXISTS "PointsUpdate" (
  "id"        TEXT NOT NULL,
  "title"     TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "kind"      TEXT NOT NULL DEFAULT 'update',
  "program"   TEXT,
  "url"       TEXT,
  "pinned"    BOOLEAN NOT NULL DEFAULT false,
  "published" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PointsUpdate_pkey" PRIMARY KEY ("id")
);

-- Matches the feed's ORDER BY exactly: published, pinned first, newest after.
CREATE INDEX IF NOT EXISTS "PointsUpdate_published_pinned_createdAt_idx"
  ON "PointsUpdate" ("published", "pinned", "createdAt");
