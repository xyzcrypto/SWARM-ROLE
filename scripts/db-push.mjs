#!/usr/bin/env node
/**
 * Schema push for Vercel builds. Invoked by the `vercel-build` npm script.
 *
 * WHY THIS EXISTS (read before "simplifying" it back to a one-liner):
 *
 * `vercel-build` used to be:
 *
 *   prisma db push --skip-generate || echo 'db push skipped (no DB at build)'
 *
 * That `||` swallowed EVERY failure. From an unknown date until 2026-07-29 the
 * push failed on every single deploy with `P1001: Can't reach database server`
 * (DIRECT_URL pointed at the IPv6-only direct Supabase host, from an IPv4-only
 * Vercel runtime). The deploy succeeded, CI went green, the site worked - and no
 * migration applied for weeks. Signups silently starved on columns that were
 * never created. The only trace anywhere was one line in a build log.
 *
 * So this script draws the distinction the `||` could not:
 *   - nothing to push to        -> skip quietly, exit 0
 *   - something to push to, and it failed -> FAIL THE BUILD, loudly
 *
 * A failed build does NOT take the site down: Vercel keeps the previous
 * deployment serving and only swaps the production alias after a build succeeds.
 * The worst case here is "this deploy doesn't ship until the DB is reachable",
 * which is strictly better than shipping code whose schema was never applied.
 *
 * See docs/HANDOFF.md §8 for the full incident.
 */
import { spawnSync } from "node:child_process";

const RETRY_DELAYS_MS = [2000, 4000]; // 3 attempts total

function skip(reason) {
  console.log(`[db-push] ${reason} - skipping schema push.`);
  process.exit(0);
}

function fail(reason) {
  console.error("");
  console.error("!!! ------------------------------------------------------------");
  console.error(`!!! [db-push] SCHEMA SYNC FAILED: ${reason}`);
  console.error("!!! Failing the build deliberately, so this cannot ship unnoticed.");
  console.error("!!! The previous deployment stays live - the site is NOT down.");
  console.error("!!! Check DIRECT_URL (must be the Supabase SESSION POOLER,");
  console.error("!!! aws-0-<region>.pooler.supabase.com:5432 - not the direct host).");
  console.error("!!! ------------------------------------------------------------");
  console.error("");
  process.exit(1);
}

// 1. Only a real Vercel PRODUCTION build may touch the schema.
//    Strict equality on purpose - local builds, CI and preview deployments all
//    have VERCEL_ENV unset or set to something else, and none of them should be
//    mutating the production database. Preview deployments share the production
//    DATABASE_URL, so without this gate every branch push would rewrite the
//    production schema before review.
if (process.env.VERCEL_ENV !== "production") {
  skip(`VERCEL_ENV=${process.env.VERCEL_ENV ?? "(unset)"}`);
}

// 2. Past this point we ARE a production deploy, so missing DB config is a real
//    problem rather than a reason to skip quietly.
if (!process.env.DATABASE_URL) fail("DATABASE_URL is not set on a production build");
if (!process.env.DIRECT_URL) fail("DIRECT_URL is not set on a production build");

// 3. Push, retrying only to absorb a transient blip. A genuine misconfiguration
//    simply fails all three attempts and then fails the build, which is the point.
for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt++) {
  const res = spawnSync("npx", ["prisma", "db", "push", "--skip-generate"], {
    stdio: "inherit",
    env: process.env,
  });

  if (res.status === 0) {
    console.log("[db-push] schema is in sync.");
    process.exit(0);
  }

  const delay = RETRY_DELAYS_MS[attempt - 1];
  if (delay === undefined) {
    fail(`prisma db push exited ${res.status ?? "with a signal"} after ${attempt} attempts`);
  }
  console.warn(`[db-push] attempt ${attempt} failed - retrying in ${delay}ms...`);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay); // sync sleep
}
