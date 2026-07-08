-- Direct messages: Telegram-style 1-on-1 conversations + messages.
-- Idempotent (safe to re-run via db push).

CREATE TABLE IF NOT EXISTS "Conversation" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastBody" TEXT,
  "lastSenderId" TEXT,
  "userAId" TEXT NOT NULL,
  "userBId" TEXT NOT NULL,
  "readAAt" TIMESTAMP(3),
  "readBAt" TIMESTAMP(3),
  CONSTRAINT "Conversation_userAId_fkey" FOREIGN KEY ("userAId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Conversation_userBId_fkey" FOREIGN KEY ("userBId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_userAId_userBId_key" ON "Conversation"("userAId", "userBId");
CREATE INDEX IF NOT EXISTS "Conversation_userAId_lastMessageAt_idx" ON "Conversation"("userAId", "lastMessageAt");
CREATE INDEX IF NOT EXISTS "Conversation_userBId_lastMessageAt_idx" ON "Conversation"("userBId", "lastMessageAt");

CREATE TABLE IF NOT EXISTS "DirectMessage" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "body" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  CONSTRAINT "DirectMessage_conversationId_fkey" FOREIGN KEY ("conversationId")
    REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DirectMessage_senderId_fkey" FOREIGN KEY ("senderId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DirectMessage_conversationId_createdAt_idx" ON "DirectMessage"("conversationId", "createdAt");
