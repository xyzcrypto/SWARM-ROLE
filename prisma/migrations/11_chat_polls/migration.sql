-- Chat v3: Telegram-style polls + pinned messages. Idempotent like all
-- migrations here (safe to re-run via `prisma db push` / vercel-build).

ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "pinnedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "ChatPoll" (
  "id" TEXT PRIMARY KEY,
  "question" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "messageId" TEXT NOT NULL,
  CONSTRAINT "ChatPoll_messageId_fkey" FOREIGN KEY ("messageId")
    REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ChatPoll_messageId_key" ON "ChatPoll"("messageId");

CREATE TABLE IF NOT EXISTS "ChatPollOption" (
  "id" TEXT PRIMARY KEY,
  "text" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "pollId" TEXT NOT NULL,
  CONSTRAINT "ChatPollOption_pollId_fkey" FOREIGN KEY ("pollId")
    REFERENCES "ChatPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ChatPollOption_pollId_order_idx" ON "ChatPollOption"("pollId", "order");

CREATE TABLE IF NOT EXISTS "ChatPollVote" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "pollId" TEXT NOT NULL,
  "optionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "ChatPollVote_pollId_fkey" FOREIGN KEY ("pollId")
    REFERENCES "ChatPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChatPollVote_optionId_fkey" FOREIGN KEY ("optionId")
    REFERENCES "ChatPollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChatPollVote_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ChatPollVote_pollId_userId_key" ON "ChatPollVote"("pollId", "userId");
CREATE INDEX IF NOT EXISTS "ChatPollVote_optionId_idx" ON "ChatPollVote"("optionId");
