-- DM replies and forwarding.
--
-- Idempotent: safe to run more than once.

-- Reply / quote, mirroring ChatMessage's self-relation. ON DELETE SET NULL so a
-- reply survives its parent being removed rather than cascading away with it.
ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "replyToId" TEXT;

-- "Forwarded" is a flag, not a link: a reference to the original would point
-- into a conversation the recipient has no right to read.
ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "forwarded" BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DirectMessage_replyToId_fkey'
  ) THEN
    ALTER TABLE "DirectMessage"
      ADD CONSTRAINT "DirectMessage_replyToId_fkey"
      FOREIGN KEY ("replyToId") REFERENCES "DirectMessage"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Loading a thread reads replies alongside their parents.
CREATE INDEX IF NOT EXISTS "DirectMessage_replyToId_idx" ON "DirectMessage" ("replyToId");
