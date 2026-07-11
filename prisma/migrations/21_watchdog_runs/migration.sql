-- XYZ Sentinel: history of scheduled security/health checks (one row per run).
-- Written idempotently (IF NOT EXISTS) so it is safe to apply via
-- `prisma migrate deploy`, `prisma db push`, or by pasting into the Supabase SQL
-- editor even if the table was already created out-of-band. The watchdog route
-- degrades gracefully until this is applied (it still runs + alerts; it just
-- can't persist history / dedupe).

CREATE TABLE IF NOT EXISTS "WatchdogRun" (
    "id" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" TEXT NOT NULL,
    "flags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "summary" TEXT,
    "metrics" JSONB,
    "alerted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WatchdogRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WatchdogRun_ranAt_idx" ON "WatchdogRun"("ranAt");
