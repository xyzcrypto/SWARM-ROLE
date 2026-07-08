-- Saved news stories — one row per user per external story URL. Stores enough of
-- the story to render the "Saved" tab without re-fetching the live feed, so saves
-- persist across devices and time. Idempotent (safe to re-run via db push).

CREATE TABLE IF NOT EXISTS "SavedStory" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "url" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "source" TEXT,
  "image" TEXT,
  "category" TEXT,
  "publishedAt" TIMESTAMP(3),
  "userId" TEXT NOT NULL,
  CONSTRAINT "SavedStory_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "SavedStory_userId_url_key" ON "SavedStory"("userId", "url");
CREATE INDEX IF NOT EXISTS "SavedStory_userId_createdAt_idx" ON "SavedStory"("userId", "createdAt");
