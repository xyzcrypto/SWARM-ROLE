import * as Sentry from "@sentry/nextjs";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

// Serverless-safe rate limiting via Upstash Redis. If the Upstash env is not
// configured (local dev, or not set up yet), this is a permissive no-op so the
// app never crashes - limits only apply once UPSTASH_* env vars exist.
const enabled = !!env.UPSTASH_REDIS_REST_URL && !!env.UPSTASH_REDIS_REST_TOKEN;

// Loudly flag the no-op fallback in production so a misconfigured Upstash (which
// silently disables ALL brute-force protection) can't go unnoticed. A plain
// console.warn is easy to miss in log volume - also report it to Sentry
// (once per cold start, not per-request) so it shows up as a real alert
// rather than something only visible by log-scraping.
if (!enabled && process.env.NODE_ENV === "production") {
  console.warn(
    "[ratelimit] SECURITY: Upstash is not configured - rate limiting is DISABLED in production. Set UPSTASH_REDIS_REST_URL/TOKEN."
  );
  Sentry.captureMessage(
    "Rate limiting is DISABLED in production (Upstash env not configured) - all brute-force/abuse limits are currently no-ops.",
    "error"
  );
}

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
  profile: make(10, 60, "profile"), // 10/min per user - avatar + profile edits
  comment: make(8, 60, "comment"), // 8/min/IP
  like: make(20, 60, "like"), // 20/min/IP
  login: make(5, 60, "login"), // 5/min per account (brute-force guard)
  // 10/min/IP - reset flow (start + reset), isolated from signup. Accommodates shared CGNAT/office IPs while mitigating abuse.
  password: make(10, 60, "password"),
  chat: make(10, 60, "chat"), // 10 messages/min per user (community chat)
  // The presence heartbeat needs its own bucket. It used to spend the `chat`
  // one, which is the budget for SENDING - so an unattended beat every 25s
  // (more when the tab is woken, and it only runs at all when realtime is down)
  // quietly ate 3-4 of a chatter's 10 messages per minute, and they hit
  // "Too many requests" while typing normally. Presence is a cheap upsert on the
  // caller's own row, so it can be generous; keeping it separate means a busy
  // room can never throttle the composer.
  chatPresence: make(30, 60, "chat_presence"), // 30/min per user - heartbeat only
  dm: make(20, 60, "dm"), // 20 direct messages/min per user
  // Link previews (api/link-preview). Only an edge-cache MISS reaches the
  // limiter, but opening a room full of links can fire a burst of those, and
  // `comment` (8/min) would silently drop most of them.
  linkPreview: make(30, 60, "link_preview"), // 30/min per user and per IP
  notifications: make(60, 60, "notifications"), // 60/min per user - bell polling + mark-read
  contact: make(5, 60, "contact"), // 5/min/IP - contact form (own bucket so /track bursts can't 429 it)
  ai: make(15, 60, "ai"), // 15/min per user - XYZ AI assistant turns (keyed by user id)
  journal: make(30, 60, "journal"), // 30/min per user - trade log CRUD
  xp: make(30, 60, "xp"), // 30/min per user - XP award pings
  shareCreate: make(15, 60, "share_create"), // 15/min/IP - short-link creation (anonymous)
  postView: make(30, 60, "post_view"), // 30/min/IP - article view beacon (anonymous)
  media: make(120, 60, "media"), // 120/min/IP - api/media image serving (anonymous). Generous on purpose:
  // real traffic is served by the CDN and only reaches the origin on a genuine cache miss, so a visitor
  // costs a handful of these per session even on an avatar-heavy page. What it bounds is the residue the
  // token check cannot remove - a valid user id with a forged token still costs an invocation and a DB
  // read before the 404, and that is the only part of the old unbounded cache-key vector left.
  otpEmail: make(3, 600, "otp_email"), // 3/10min per target email - anti email-bombing (allows retry without hour-long lockouts on mistype or latency)
  // 20/min/IP - independent of the per-email `login` limiter, which a
  // bot rotating through many fake/guessed emails from one IP barely engages. Each failed login attempt
  // (real or fake account) does a bcrypt compare - genuine synchronous CPU, not just I/O - so unthrottled
  // per-IP volume is a real cost, not just a security concern.
  // In India and emerging markets, mobile carriers (Jio, Airtel) and college/office WiFis heavily rely on
  // CGNAT where thousands of users share a single public IP. 20/min avoids locking out legitimate users on
  // shared IPs while still bounding bcrypt CPU exhaustion.
  loginIp: make(20, 60, "login_ip"),
  // /creators X submissions. Each one costs an outbound fetch to X's embed
  // endpoint, so it is bounded per member AND per IP (two keys, per the house rule).
  creatorSubmit: make(10, 600, "creator_submit"), // 10/10min
};

export type RateKey = keyof typeof limiters;

/** Returns { success } - always succeeds when limiting is not configured. */
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

/**
 * Best-effort client IP from proxy headers. `x-vercel-forwarded-for` is set
 * by Vercel's own edge network and is NOT client-controllable (Vercel
 * overwrites this specific header before a request reaches the function), so
 * it's authoritative in production. Plain `x-forwarded-for` is trusted only
 * as a fallback (local dev / non-Vercel hosting) - a client can freely set
 * that header themselves, so relying on it alone lets every IP-keyed limiter
 * (signup, comment, like, subscribe, password reset) be bypassed just by
 * rotating the header value on each request.
 */
export function clientIp(req: Request): string {
  const vercelIp = req.headers.get("x-vercel-forwarded-for");
  if (vercelIp) return vercelIp.split(",")[0]!.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") || "anon";
}

/**
 * Same priority order as `clientIp()`, but for a plain headers record instead
 * of a `Request` - NextAuth's `authorize(credentials, req)` passes `req.headers`
 * as `Record<string, any>` (lowercased keys), not a `Headers` instance with
 * `.get()`, so it needs its own reader rather than reusing `clientIp()` as-is.
 */
export function clientIpFromHeaders(headers: Record<string, any> | undefined): string {
  const get = (name: string): string | undefined => {
    const v = headers?.[name];
    return Array.isArray(v) ? v[0] : v;
  };
  const vercelIp = get("x-vercel-forwarded-for");
  if (vercelIp) return vercelIp.split(",")[0]!.trim();
  const xff = get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return get("x-real-ip") || "anon";
}
