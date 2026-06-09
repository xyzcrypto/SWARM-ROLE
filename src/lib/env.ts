// Centralized, validated environment access. Validation is **warn-only** so it
// never crashes the build or a request — but it surfaces misconfiguration loudly
// in logs. Read config from here instead of raw process.env.
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  DIRECT_URL: z.string().optional(),
  NEXTAUTH_SECRET: z.string().min(16).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

// In production, required-but-missing config is a real problem — log it clearly.
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
  UPSTASH_REDIS_REST_URL: raw.UPSTASH_REDIS_REST_URL ?? "",
  UPSTASH_REDIS_REST_TOKEN: raw.UPSTASH_REDIS_REST_TOKEN ?? "",
};

export const googleEnabled = !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;

// Admins: ADMIN_EMAILS (comma-separated) preferred, ADMIN_EMAIL as fallback.
export const adminEmails: string[] = (raw.ADMIN_EMAILS || raw.ADMIN_EMAIL || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails.includes(email.toLowerCase().trim());
}
