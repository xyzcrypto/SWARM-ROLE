-- DM message actions: edit, soft delete, pin.
--
-- `status` mirrors ChatMessage rather than deleting the row: the thread keeps
-- its shape, and a reported message stays investigable after its sender
-- removes it.
--
-- Idempotent: safe to run more than once.

ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'visible';
ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3);
ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "pinnedAt" TIMESTAMP(3);

-- Serves the pinned banner: newest pinned message in a conversation.
CREATE INDEX IF NOT EXISTS "DirectMessage_conversationId_pinnedAt_idx"
  ON "DirectMessage" ("conversationId", "pinnedAt");
