// Centralized, validated environment access. Validation is **warn-only** so it
// never crashes the build or a request - but it surfaces misconfiguration loudly
// in logs. Read config from here instead of raw process.env.
import { z } from "zod";

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
  SUPABASE_URL: (raw.SUPABASE_URL ?? "").replace(/\/$/, ""),
  SUPABASE_SERVICE_ROLE_KEY: raw.SUPABASE_SERVICE_ROLE_KEY ?? "",
  SUPABASE_STORAGE_BUCKET: raw.SUPABASE_STORAGE_BUCKET || "post-covers",
  // Groq (XYZ AI features). Server-only — NEVER exposed client-side.
  GROQ_API_KEY: raw.GROQ_API_KEY ?? "",
  // Public (client-safe by design) - used by the chat page for Supabase
  // Realtime subscriptions. The anon key only grants what RLS/channel policy
  // allows; the service-role key above must NEVER be exposed client-side.
  NEXT_PUBLIC_SUPABASE_URL: (raw.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, ""),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: raw.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
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

// XYZ AI (Groq). When unset, every AI surface no-ops gracefully: the assistant
// route returns 503, summaries/auto-moderation simply skip. Set GROQ_API_KEY
// (Vercel env) to activate. Server-only flag — never read the key client-side.
export const aiEnabled = !!env.GROQ_API_KEY;

// Admins: ADMIN_EMAILS (comma-separated) preferred, ADMIN_EMAIL as fallback.
export const adminEmails: string[] = (raw.ADMIN_EMAILS || raw.ADMIN_EMAIL || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails.includes(email.toLowerCase().trim());
}
