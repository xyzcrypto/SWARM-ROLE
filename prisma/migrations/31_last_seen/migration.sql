-- "Last seen" for DMs.
--
-- Deliberately on User rather than ChatPresence: the presence row is DELETED by
-- the pagehide beacon, which is precisely the moment a last-seen timestamp
-- becomes worth having. This column is written by the presence endpoints the
-- site already calls, so it adds no new requests.
--
-- Idempotent: safe to run more than once.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);
