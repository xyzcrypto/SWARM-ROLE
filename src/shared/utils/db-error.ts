/**
 * Telling "this row does not exist" apart from "the database did not answer".
 *
 * This codebase deliberately swallows Prisma errors on read paths so that a
 * database whose schema has not caught up yet degrades instead of crashing -
 * `.catch(() => null)` / `.catch(() => [])` appear all over. That is the right
 * call for a MISSING TABLE OR COLUMN, which is a known, temporary, expected
 * state here (`vercel-build` applies the schema on production deploys).
 *
 * It is the wrong call for everything else, and the difference showed up in
 * production:
 *
 *  - `/u/<handle>` caught a failed query, got `null`, and called `notFound()` -
 *    so a database that was simply unreachable rendered as **"Page not found"
 *    on a profile that exists**.
 *  - `/community` caught the same failure and rendered **"No messages yet - be
 *    the first to say gm."** in a room with a full history.
 *
 * Both are confident, plausible, wrong answers, and a user cannot tell either
 * from the real thing - the same failure mode as the storage diagnostic
 * blaming a bucket for a bad key. An unreachable database should surface as an
 * error, which is honest and self-heals the moment the database answers again.
 *
 * P2021 = table does not exist. P2022 = column does not exist.
 */
const MISSING_SCHEMA = new Set(["P2021", "P2022"]);

export function isMissingSchema(err: unknown): boolean {
  const code = (err as { code?: unknown } | null | undefined)?.code;
  return typeof code === "string" && MISSING_SCHEMA.has(code);
}

/**
 * Use as `.catch(schemaOrThrow)` on a read whose caller treats `null` as "not
 * found". Keeps the graceful un-migrated path; turns a genuine outage back into
 * a thrown error so it is never rendered - or cached - as an answer.
 */
export function schemaOrThrow(err: unknown): null {
  if (isMissingSchema(err)) {
    logSwallowed(err);
    return null;
  }
  throw err;
}

/** Same, for reads whose caller expects a list. */
export function schemaOrThrowList<T>(err: unknown): T[] {
  if (isMissingSchema(err)) {
    logSwallowed(err);
    return [];
  }
  throw err;
}

/**
 * The degrade path is deliberate, but it must not be SILENT.
 *
 * A swallowed P2021/P2022 renders as "this profile does not exist" or "no
 * messages yet" with nothing anywhere to say the schema is behind - which is
 * indistinguishable from the real thing, and is precisely how the production
 * schema drift recorded in CLAUDE.md went unnoticed for weeks. One line in the
 * server log costs nothing and turns it into a five-second diagnosis.
 */
function logSwallowed(err: unknown) {
  const e = err as { code?: string; meta?: Record<string, unknown> } | null;
  console.error(
    `[db] SCHEMA BEHIND (${e?.code}): a query was answered with an empty result instead of failing. ` +
      `The database is missing a table or column that schema.prisma expects` +
      (e?.meta ? ` - ${JSON.stringify(e.meta)}` : "") +
      `. Redeploy (migrations run on production deploys) or run \`npm run db:push\` against production. ` +
      `Until then this surface will look empty rather than broken.`
  );
}
