/**
 * Serverless-safe connection settings for the pooled Prisma datasource.
 *
 * ## The problem this exists for
 *
 * `prisma/schema.prisma` says, in its own header:
 *
 *     Recommended: `?pgbouncer=true&connection_limit=1`
 *
 * and `.env.example` ships `…?pgbouncer=true` **without** the connection limit.
 * A recommendation that lives only in a comment is not applied, and this one
 * was not: production has `pgbouncer=true` and no limit.
 *
 * Without an explicit limit Prisma sizes its pool at `num_cpus * 2 + 1` **per
 * client**, and on serverless there is one client per warm function instance.
 * A handful of concurrent instances - each holding five to seventeen pooler
 * connections - is enough to exhaust a Supabase free-tier pooler. What that
 * looks like from the outside is not an outage: it is
 * `Timed out fetching a new connection from the connection pool`, on *some*
 * requests, so the profile breaks sometimes, the DM sometimes does not open,
 * the chat sometimes has nothing in it - never together, never reproducible.
 * That is exactly the reported symptom.
 *
 * Setting it here rather than only in the env var means the fix cannot be lost
 * to a copy-paste: whatever `DATABASE_URL` holds, the pool is bounded. An
 * explicit value in the URL still wins, so an operator can override it.
 *
 * `pool_timeout` is raised from the 10s default: once the pool is bounded, a
 * burst of concurrent queries inside one instance queues rather than opening
 * more connections, and 10s is tight enough to turn a queued query into a
 * spurious failure.
 *
 * ## Honest scope
 *
 * Whether this changes anything in production is UNCONFIRMED. The default is
 * derived from the runtime's CPU count, which is not observable from here - on
 * a small Vercel function it may already land near 5, in which case this only
 * makes the value explicit and predictable instead of runtime-dependent. The
 * part that is definitely new is the longer timeout, and the P2024 branch in
 * `handleError` that finally names pool exhaustion when it happens.
 */
const DEFAULTS: Record<string, string> = {
  // 5, NOT the 1 that Prisma's serverless guidance suggests. This app fans out
  // per page - `/u/[username]` alone issues six queries in one `Promise.all` -
  // and a limit of 1 serializes every one of them, undoing the round-trip work
  // done earlier and turning ordinary page loads into pool waits. Measured
  // while writing this: 40 concurrent queries against `connection_limit=1`
  // produced `P2024 Timed out fetching a new connection`, which is the very
  // failure this is meant to prevent. 5 bounds the worst case per instance
  // while leaving in-page parallelism intact.
  connection_limit: "5",
  // 20s, up from Prisma's 10s default. Under brief contention the difference
  // is between queueing and failing, and a slow response beats a wrong one.
  pool_timeout: "20",
};

export function withPoolDefaults(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    for (const [key, value] of Object.entries(DEFAULTS)) {
      // Never override an explicit setting - an operator who tuned this meant it.
      if (!url.searchParams.has(key)) url.searchParams.set(key, value);
    }
    return url.toString();
  } catch {
    // An unparseable URL is not this function's problem to report - hand it
    // back untouched and let Prisma produce its own, much clearer, error.
    return raw;
  }
}
