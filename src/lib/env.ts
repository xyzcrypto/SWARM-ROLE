// Centralized, validated environment access. Validation is **warn-only** so it
// never crashes the build or a request - but it surfaces misconfiguration loudly
// in logs. Read config from here instead of raw process.env.
import { z } from "zod";
import { site } from "@/lib/site";

const schema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  DIRECT_URL: z.string().optional(),
  NEXTAUTH_SECRET: z.string().min(16).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  TWITTER_CLIENT_ID: z.string().optional(),
  TWITTER_CLIENT_SECRET: z.string().optional(),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  AI_PROVIDER_ORDER: z.string().optional(),
  AI_DAILY_LIMIT_FREE: z.string().optional(),
  AI_DAILY_LIMIT_PREMIUM: z.string().optional(),
  AI_DAILY_LIMIT_ADMIN: z.string().optional(),
  CMC_API_KEY: z.string().optional(),
  GIPHY_API_KEY: z.string().optional(), // community-chat GIF search (Giphy)
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  // LiveKit (community voice rooms). Server signs tokens; the browser connects
  // to the public wss URL. All three needed to enable voice.
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  NEXT_PUBLIC_LIVEKIT_URL: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

// In production, required-but-missing config is a real problem - log it clearly.
const REQUIRED_IN_PROD = ["DATABASE_URL", "NEXTAUTH_SECRET"] as const;
if (process.env.NODE_ENV === "production") {
  for (const key of REQUIRED_IN_PROD) {
    if (!process.env[key]) {
      console.error(`[env] Missing required env var in production: ${key}`);
    }
  }
}
if (!parsed.success) {
  console.error("[env] Invalid environment variables:", parsed.error.flatten().fieldErrors);
}

const raw = process.env;

export const env = {
  DATABASE_URL: raw.DATABASE_URL ?? "",
  DIRECT_URL: raw.DIRECT_URL ?? "",
  NEXTAUTH_SECRET: raw.NEXTAUTH_SECRET ?? "",
  NEXTAUTH_URL: raw.NEXTAUTH_URL ?? "",
  GOOGLE_CLIENT_ID: raw.GOOGLE_CLIENT_ID ?? "",
  GOOGLE_CLIENT_SECRET: raw.GOOGLE_CLIENT_SECRET ?? "",
  GITHUB_CLIENT_ID: raw.GITHUB_CLIENT_ID ?? "",
  GITHUB_CLIENT_SECRET: raw.GITHUB_CLIENT_SECRET ?? "",
  TWITTER_CLIENT_ID: raw.TWITTER_CLIENT_ID ?? "",
  TWITTER_CLIENT_SECRET: raw.TWITTER_CLIENT_SECRET ?? "",
  UPSTASH_REDIS_REST_URL: raw.UPSTASH_REDIS_REST_URL ?? "",
  UPSTASH_REDIS_REST_TOKEN: raw.UPSTASH_REDIS_REST_TOKEN ?? "",
  RESEND_API_KEY: raw.RESEND_API_KEY ?? "",
  EMAIL_FROM: raw.EMAIL_FROM || "XYZ Crypto <onboarding@resend.dev>",
  // Base project URL only. The Supabase SDK appends /rest/v1, /realtime/v1,
  // /storage/v1 itself, so strip any trailing /rest/v1 (a common misconfig that
  // makes the realtime WS URL malformed and retry forever) + trailing slash.
  SUPABASE_URL: (raw.SUPABASE_URL ?? "").replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, ""),
  SUPABASE_SERVICE_ROLE_KEY: raw.SUPABASE_SERVICE_ROLE_KEY ?? "",
  SUPABASE_STORAGE_BUCKET: raw.SUPABASE_STORAGE_BUCKET || "post-covers",
  // XYZ AI providers. All server-only - NEVER exposed client-side. GROQ works
  // today; adding GEMINI_API_KEY promotes Gemini to primary (Groq auto-fallback).
  // AI_PROVIDER_ORDER (e.g. "gemini,groq") overrides the default chain order.
  GROQ_API_KEY: raw.GROQ_API_KEY ?? "",
  GEMINI_API_KEY: raw.GEMINI_API_KEY ?? "",
  AI_PROVIDER_ORDER: raw.AI_PROVIDER_ORDER ?? "",
  // Per-plan daily AI request caps (optional overrides of the built-in defaults).
  AI_DAILY_LIMIT_FREE: raw.AI_DAILY_LIMIT_FREE ?? "",
  AI_DAILY_LIMIT_PREMIUM: raw.AI_DAILY_LIMIT_PREMIUM ?? "",
  AI_DAILY_LIMIT_ADMIN: raw.AI_DAILY_LIMIT_ADMIN ?? "",
  // CoinMarketCap (Markets hub - optional enrichment). Server-only.
  CMC_API_KEY: raw.CMC_API_KEY ?? "",
  // Giphy (community-chat GIF search). Server-only; no key -> GIF picker hidden.
  GIPHY_API_KEY: raw.GIPHY_API_KEY ?? "",
  // Web Push (news alerts). Public key is client-safe; private key + cron secret
  // are server-only.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: raw.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  VAPID_PRIVATE_KEY: raw.VAPID_PRIVATE_KEY ?? "",
  // web-push requires a non-empty, valid contact URI here once the VAPID keys
  // are set (setVapidDetails throws otherwise) - falls back to the site's
  // existing public support address rather than a real personal one.
  VAPID_SUBJECT: raw.VAPID_SUBJECT || `mailto:${site.email}`,
  CRON_SECRET: raw.CRON_SECRET ?? "",
  // Telegram bot (XYZ Sentinel security alerts to the owner). Server-only.
  TELEGRAM_BOT_TOKEN: raw.TELEGRAM_BOT_TOKEN ?? "",
  TELEGRAM_CHAT_ID: raw.TELEGRAM_CHAT_ID ?? "",
  // Public (client-safe by design) - used by the chat page for Supabase
  // Realtime subscriptions. The anon key only grants what RLS/channel policy
  // allows; the service-role key above must NEVER be exposed client-side.
  NEXT_PUBLIC_SUPABASE_URL: (raw.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, ""),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: raw.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  // LiveKit (community voice rooms). Server-only key/secret + public wss URL.
  LIVEKIT_API_KEY: raw.LIVEKIT_API_KEY ?? "",
  LIVEKIT_API_SECRET: raw.LIVEKIT_API_SECRET ?? "",
  NEXT_PUBLIC_LIVEKIT_URL: (raw.NEXT_PUBLIC_LIVEKIT_URL ?? "").replace(/\/$/, ""),
};

export const googleEnabled = !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;
export const githubEnabled = !!env.GITHUB_CLIENT_ID && !!env.GITHUB_CLIENT_SECRET;
export const twitterEnabled = !!env.TWITTER_CLIENT_ID && !!env.TWITTER_CLIENT_SECRET;

// Email (Resend). When unset, OTP codes are logged to the server console so the
// flow still works for local/testing - set RESEND_API_KEY to actually deliver.
export const emailEnabled = !!env.RESEND_API_KEY;

// Image upload (Supabase Storage). When unset, the cover URL field still works
// and the upload endpoint reports that uploads are disabled.
export const storageEnabled = !!env.SUPABASE_URL && !!env.SUPABASE_SERVICE_ROLE_KEY;

// Realtime chat broadcast (server-side send). Falls back to client polling
// when unset - chat still works, just not instant.
export const realtimeEnabled = storageEnabled; // same creds: SUPABASE_URL + service key

// XYZ AI providers. Each flag is true when that provider's key is configured;
// the gateway (src/lib/ai/*) uses whichever are enabled, in AI_PROVIDER_ORDER,
// with automatic fallback. `aiEnabled` is true when AT LEAST ONE provider is
// configured - when false, every AI surface no-ops gracefully (assistant route
// 503, summaries/auto-moderation skip). Server-only - never read keys client-side.
export const groqEnabled = !!env.GROQ_API_KEY;
export const geminiEnabled = !!env.GEMINI_API_KEY;

// Community-chat GIF search (Giphy). No key -> the GIF picker is hidden.
export const gifEnabled = !!env.GIPHY_API_KEY;

// Telegram alerting (XYZ Sentinel). True when both the bot token + chat id are
// set; otherwise sendTelegram() no-ops and Sentinel falls back to email only.
export const telegramEnabled = !!env.TELEGRAM_BOT_TOKEN && !!env.TELEGRAM_CHAT_ID;

// Whether Sentry crash reporting has a DSN configured (read directly - the
// sentry.*.config.ts files use these process.env vars). Sentinel reports this
// as a health flag so the owner knows to enable real-time error alerting.
export const sentryConfigured = !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
export const aiEnabled = groqEnabled || geminiEnabled;

// CoinMarketCap enrichment on the Markets hub. Optional - the hub works from the
// free keyless sources (CoinGecko + DefiLlama + Fear&Greed) without it; when set,
// the global route adds CMC's DeFi / stablecoin market-cap metrics.
export const cmcEnabled = !!env.CMC_API_KEY;

// Web Push (news alerts). Off until both VAPID keys are set - then the /news
// "Enable alerts" toggle activates and the cron dispatch can send.
export const pushEnabled = !!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!env.VAPID_PRIVATE_KEY;

// Community voice rooms (LiveKit). Off until the key/secret + public wss URL are
// all set - then the "Join voice" bar appears and tokens can be minted.
export const voiceEnabled =
  !!env.LIVEKIT_API_KEY && !!env.LIVEKIT_API_SECRET && !!env.NEXT_PUBLIC_LIVEKIT_URL;

// Admins: ADMIN_EMAILS (comma-separated) preferred, ADMIN_EMAIL as fallback.
export const adminEmails: string[] = (raw.ADMIN_EMAILS || raw.ADMIN_EMAIL || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails.includes(email.toLowerCase().trim());
}
