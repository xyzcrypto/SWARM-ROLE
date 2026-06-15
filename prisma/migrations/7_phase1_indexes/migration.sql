-- Phase 1 performance indexes. Idempotent (IF NOT EXISTS) so it is safe to apply
-- via `prisma migrate deploy`, `db push`, or pasted into the Supabase SQL editor,
-- even if an index was already created out-of-band. Purely additive.

-- Bell list: WHERE userId ORDER BY createdAt DESC (complements the read-filtered index).
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx"
  ON "Notification"("userId", "createdAt");

-- Dashboard premium-member list: WHERE membership ORDER BY createdAt DESC.
CREATE INDEX IF NOT EXISTS "User_membership_createdAt_idx"
  ON "User"("membership", "createdAt");

-- Analytics by path over time.
CREATE INDEX IF NOT EXISTS "PageView_path_createdAt_idx"
  ON "PageView"("path", "createdAt");
