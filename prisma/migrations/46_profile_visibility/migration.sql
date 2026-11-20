-- Public/private profile switch (/settings -> Privacy). Additive and idempotent.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileVisibility" TEXT NOT NULL DEFAULT 'public';

-- Optional screenshot on /feedback. Additive and idempotent.
ALTER TABLE "Feedback" ADD COLUMN IF NOT EXISTS "image" TEXT;
