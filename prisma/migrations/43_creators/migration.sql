-- Creators (/creators): tracked X posts and accounts, the YouTube discovery
-- store, and the sync cursors/quota guard (CreatorSync).
--
-- Recorded after the fact: these tables reached production through `db push`
-- (scripts/db-push.mjs). Idempotent throughout (IF NOT EXISTS / DO-blocks) so it
-- is safe on a database that already has them, matching 42_chat_bookmarks.
-- Additive only.
CREATE TABLE IF NOT EXISTS "CreatorPost" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tweetId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "authorHandle" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorAvatar" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "text" TEXT NOT NULL,
    "tweetCreatedAt" TIMESTAMP(3) NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "replies" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'visible',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedById" TEXT,

    CONSTRAINT "CreatorPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "XAccount" (
    "id" TEXT NOT NULL,
    "handleLower" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "xId" TEXT,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "bio" TEXT NOT NULL DEFAULT '',
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "scannedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "XTweet" (
    "id" TEXT NOT NULL,
    "tweetId" TEXT NOT NULL,
    "authorLower" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "tweetCreatedAt" TIMESTAMP(3) NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "replies" INTEGER NOT NULL DEFAULT 0,
    "reposts" INTEGER NOT NULL DEFAULT 0,
    "quotes" INTEGER NOT NULL DEFAULT 0,
    "bookmarks" INTEGER NOT NULL DEFAULT 0,
    "isReply" BOOLEAN NOT NULL DEFAULT false,
    "venues" TEXT[] DEFAULT ARRAY['variational']::TEXT[],
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XTweet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CreatorSync" (
    "key" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cursor" TEXT,
    "day" TEXT NOT NULL DEFAULT '',
    "spent" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorSync_pkey" PRIMARY KEY ("key")
);

CREATE TABLE IF NOT EXISTS "YtDiscovery" (
    "topic" TEXT NOT NULL,
    "videos" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YtDiscovery_pkey" PRIMARY KEY ("topic")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CreatorPost_tweetId_key" ON "CreatorPost"("tweetId");

CREATE INDEX IF NOT EXISTS "CreatorPost_status_fetchedAt_idx" ON "CreatorPost"("status", "fetchedAt");

CREATE INDEX IF NOT EXISTS "CreatorPost_authorHandle_idx" ON "CreatorPost"("authorHandle");

CREATE UNIQUE INDEX IF NOT EXISTS "XAccount_handleLower_key" ON "XAccount"("handleLower");

CREATE UNIQUE INDEX IF NOT EXISTS "XTweet_tweetId_key" ON "XTweet"("tweetId");

CREATE INDEX IF NOT EXISTS "XTweet_authorLower_tweetCreatedAt_idx" ON "XTweet"("authorLower", "tweetCreatedAt");

CREATE INDEX IF NOT EXISTS "XTweet_tweetCreatedAt_idx" ON "XTweet"("tweetCreatedAt");

CREATE INDEX IF NOT EXISTS "XTweet_fetchedAt_idx" ON "XTweet"("fetchedAt");
