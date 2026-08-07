import "server-only";
// Shared Upstash Redis handle for the AI gateway's cache + concurrency guard.
// Lazily constructed; null when Upstash isn't configured so both callers fail
// open (same graceful pattern as src/lib/ratelimit.ts). The REST client is
// stateless HTTP, so a second instance alongside the rate-limiter is harmless.
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

let _kv: Redis | null | undefined;

export function kv(): Redis | null {
  if (_kv === undefined) {
    _kv =
      env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
        ? new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
        : null;
  }
  return _kv;
}
