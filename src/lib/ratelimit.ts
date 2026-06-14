import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

// Serverless-safe rate limiting via Upstash Redis. If the Upstash env is not
// configured (local dev, or not set up yet), this is a permissive no-op so the
// app never crashes — limits only apply once UPSTASH_* env vars exist.
const enabled = !!env.UPSTASH_REDIS_REST_URL && !!env.UPSTASH_REDIS_REST_TOKEN;

const redis = enabled
  ? new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

function make(limit: number, windowSec: number, prefix: string) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
    prefix: `xyz:rl:${prefix}`,
    analytics: false,
  });
}

// Tunable limiters per surface.
const limiters = {
  signup: make(5, 60, "signup"), // 5/min/IP
  subscribe: make(10, 60, "subscribe"), // 10/min/IP
  admin: make(30, 60, "admin"), // 30/min/IP
  profile: make(10, 60, "profile"), // 10/min per user — avatar + profile edits
  comment: make(8, 60, "comment"), // 8/min/IP
  like: make(20, 60, "like"), // 20/min/IP
  login: make(10, 60, "login"), // 10/min per account (brute-force guard)
  password: make(10, 60, "password"), // 10/min/IP — reset flow, isolated from signup
  chat: make(10, 60, "chat"), // 10 messages/min per user (community chat)
};

export type RateKey = keyof typeof limiters;

/** Returns { success } — always succeeds when limiting is not configured. */
export async function rateLimit(key: RateKey, identifier: string) {
  const limiter = limiters[key];
  if (!limiter) return { success: true as const };
  try {
    const res = await limiter.limit(identifier);
    return { success: res.success };
  } catch (err) {
    // Never let a limiter outage break the request path.
    console.error("[ratelimit] error", err);
    return { success: true as const };
  }
}

/** Best-effort client IP from standard proxy headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") || "anon";
}
