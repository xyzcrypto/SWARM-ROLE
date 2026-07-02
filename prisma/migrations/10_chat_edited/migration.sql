-- Chat message editing: timestamp set when the author edits their message
-- (15-minute window, enforced in the API). Idempotent like all migrations here.
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3);
