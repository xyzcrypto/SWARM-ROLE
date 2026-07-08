-- News social: likes + comments on external news stories, keyed by URL.
-- Idempotent (safe to re-run via db push).

CREATE TABLE IF NOT EXISTS "NewsLike" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "url" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "NewsLike_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "NewsLike_userId_url_key" ON "NewsLike"("userId", "url");
CREATE INDEX IF NOT EXISTS "NewsLike_url_idx" ON "NewsLike"("url");

CREATE TABLE IF NOT EXISTS "NewsComment" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "url" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'visible',
  "userId" TEXT NOT NULL,
  CONSTRAINT "NewsComment_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "NewsComment_url_createdAt_idx" ON "NewsComment"("url", "createdAt");
