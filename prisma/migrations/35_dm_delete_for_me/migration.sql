-- Per-side "delete for me" on a direct message.
--
-- Idempotent: safe to run more than once.
--
-- Deleting a DM used to have exactly one meaning - a tombstone, applied by
-- EITHER participant to ANY message including the other person's, because the
-- handler had no sender check. These two columns add the narrower action, and
-- the tombstone becomes own-messages-only.
--
-- Named to match Conversation.hiddenByA/hiddenByB, which already means "this
-- side removed it from their view" for a whole thread. A DM has exactly two
-- participants and A/B are already fixed by Conversation.userAId/userBId, so
-- two booleans say everything a join table would, at no cost.
--
-- Additive with a default, so existing rows are correct without a backfill:
-- nothing has been hidden by anyone yet.
ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "hiddenByA" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "hiddenByB" BOOLEAN NOT NULL DEFAULT false;

-- Loading a thread now filters on the requester's flag alongside the existing
-- conversation + createdAt ordering, so extend the index that already serves it
-- rather than adding a second one. Postgres can use the leading columns of this
-- index for the old query shape too, so nothing regresses.
CREATE INDEX IF NOT EXISTS "DirectMessage_conv_hiddenA_idx" ON "DirectMessage" ("conversationId", "hiddenByA", "createdAt");
CREATE INDEX IF NOT EXISTS "DirectMessage_conv_hiddenB_idx" ON "DirectMessage" ("conversationId", "hiddenByB", "createdAt");
