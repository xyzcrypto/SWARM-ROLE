import { createHash, timingSafeEqual } from "crypto";

// Shared authorization for the two cron entrypoints, `/api/watchdog` (XYZ
// Sentinel) and `/api/push/dispatch`.
//
// ## Why this is its own module, and why it returns a reason
//
// Both routes had the same six-line check, and it began:
//
//     if (!env.CRON_SECRET) return false; // disabled unless a secret is configured
//
// then answered a flat `403 Forbidden` either way. That collapses two completely
// different situations into one indistinguishable response:
//
//   1. the secret IS configured and the caller sent the wrong one, and
//   2. the secret is ABSENT from this deployment's runtime.
//
// (2) is not a security condition at all - it means the endpoint is switched off
// and nobody, with any credential, can reach it. But from outside there was no
// way to tell which had happened, so **XYZ Sentinel sat dark for two weeks with
// its cause recorded as "not yet pinned"** (`HANDOFF.md` §8). One earlier attempt
// to diagnose it wrote the wrong cause down as a fact and had to be retracted in
// that same section. There was no oracle to check against, so every diagnosis was
// a guess.
//
// The usual reason to blur the two is to avoid confirming an endpoint's config to
// an attacker. It does not apply here: when the secret is unset the route is
// unreachable regardless, so "it is unset" gives an attacker nothing they can use.
// What it does give the owner is a one-request answer, with no secret involved.
// A wrong *token* still gets a bare 403 with nothing to learn from - that
// distinction is the one worth keeping.
//
// Vercel bakes environment variables into a deployment at build time, so a
// variable added AFTER the last production build is genuinely missing at runtime
// while the dashboard shows it present. That is the same build-time-capture trap
// as the Sentry DSN, and `unconfigured` is what it looks like from here.

export type CronAuth = { ok: true } | { ok: false; reason: "unconfigured" | "forbidden" };

/**
 * Constant-time secret comparison.
 *
 * `timingSafeEqual` throws on length-mismatched buffers, which would leak length
 * through the exception - so both sides are hashed to a fixed 32 bytes first and
 * the digests are compared. That is the standard shape for a variable-length
 * secret, and it is what `otp.ts` already does for OTP codes.
 */
function secretEquals(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Decide whether a cron request may proceed.
 *
 * Accepts the secret either as `Authorization: Bearer <secret>` or as `?secret=`,
 * because the GitHub Actions workflows use the query form. Both are checked
 * unconditionally rather than short-circuiting on the first, so the work done
 * does not depend on which one was supplied.
 *
 * @param secret  the configured value; `""`/undefined means "not configured"
 * @param header  the raw `Authorization` header, or null
 * @param query   the raw `?secret=` parameter, or null
 */
export function checkCronAuth(
  secret: string | undefined | null,
  header: string | null,
  query: string | null
): CronAuth {
  if (!secret) return { ok: false, reason: "unconfigured" };
  const viaHeader = header ? secretEquals(header, `Bearer ${secret}`) : false;
  const viaQuery = query ? secretEquals(query, secret) : false;
  return viaHeader || viaQuery ? { ok: true } : { ok: false, reason: "forbidden" };
}

/**
 * What to tell an unauthorized caller.
 *
 * The `unconfigured` message names the variable and the redeploy, because the
 * person who sees it is the owner trying to work out why their monitor is silent
 * - and "Forbidden" has already cost two weeks of not knowing.
 */
export function cronAuthFailure(reason: "unconfigured" | "forbidden"): { message: string; status: number } {
  return reason === "unconfigured"
    ? {
        message:
          "Disabled: CRON_SECRET is not present in this deployment's runtime. " +
          "Vercel captures environment variables at build time, so a variable added after the " +
          "last production build stays absent until you redeploy.",
        status: 503,
      }
    : { message: "Forbidden", status: 403 };
}
