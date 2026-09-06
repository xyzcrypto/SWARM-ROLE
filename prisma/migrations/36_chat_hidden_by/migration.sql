-- Who hid a chat message: the AI filter, or a person.
--
-- Idempotent: safe to run more than once.
--
-- `ChatMessage.status` has only ever been "visible" | "hidden", and the AI
-- auto-moderation path sets exactly the same value a human moderator does. So
-- in the moderation queue a false positive from the toxicity classifier was
-- indistinguishable from a deliberate staff decision, and the only recovery
-- from a bad classification was "Restore all hidden" - which also undid every
-- human hide in the room.
--
-- `hiddenBy` is "ai" for the filter, otherwise the moderator's user id, and
-- null while the message is visible.
--
-- Deliberately NOT a foreign key to User: "ai" is not a user, and a moderator
-- whose account is later deleted should not cascade-null the record of who
-- hid something. This column is an audit trail, not a relation.
--
-- Additive and nullable, so existing rows are correct without a backfill.
-- Messages hidden before this shipped read as null, which is honest: we do not
-- know who hid them, and guessing would be worse than saying so.
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "hiddenBy" TEXT;

-- The moderation queue's one new question is "show me what the AI hid", which
-- is a filter on hiddenBy alongside the existing status filter.
CREATE INDEX IF NOT EXISTS "ChatMessage_status_hiddenBy_idx" ON "ChatMessage" ("status", "hiddenBy");
