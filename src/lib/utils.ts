export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export function readingTime(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** "Mon, Jul 14" - date with weekday, for trade logs where the day matters. */
export function formatDateWithDay(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: Date | string | null): string {
  if (!date) return "Never";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Privacy-safe email mask: keeps the first 2 chars of the local part, masks the
 * rest, keeps the domain. "rahul@gmail.com" -> "ra***@gmail.com". Short locals
 * keep 1 char. Returns "" for falsy input.
 */
export function maskEmail(email?: string | null): string {
  if (!email || !email.includes("@")) return email ?? "";
  const [local, domain] = email.split("@");
  if (!local) return email;
  const keep = local.length <= 2 ? 1 : 2;
  return `${local.slice(0, keep)}***@${domain}`;
}

/**
 * Escape a value for safe inclusion in a CSV cell: wraps in quotes, doubles any
 * embedded quotes, and neutralises spreadsheet formula injection by prefixing a
 * leading = + - @ with a single quote.
 */
export function csvCell(value: unknown): string {
  const s = String(value ?? "").replace(/"/g, '""');
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe}"`;
}

/**
 * Strip an inline `data:` URL image down to null instead of shipping it raw.
 * `uploadImage()` (src/lib/storage.ts) falls back to storing an uploaded
 * avatar/banner as a base64 data URL (up to 700KB) directly in the DB whenever
 * Supabase Storage is unconfigured or fails - fine for the *owner's own*
 * navbar (already guarded via the JWT, for the 4KB cookie limit), but every
 * OTHER surface that serves someone's avatar/banner to other viewers
 * (chat/DM authors, comments, follow lists, public profiles) was shipping
 * that raw blob to every viewer on every request/cache-fill. The client
 * already falls back to initials for a null image, so this is a free,
 * lossless-to-the-UI way to keep it out of hot response payloads.
 */
export function stripInlineImage(url: string | null | undefined): string | null {
  return typeof url === "string" && url.startsWith("data:") ? null : url ?? null;
}

/**
 * From GitHub's `GET /user/emails` response, return the address that is BOTH the
 * account's primary AND verified email, or null if there isn't one. Used by the
 * GitHub OAuth `profile()` callback (src/lib/auth.ts) so account-linking only
 * ever attaches to a GitHub-verified primary address - `profile.email` alone is
 * just the public email (and the default userinfo backfill picks primary, not
 * necessarily verified), neither of which proves the user owns the address.
 */
export function pickPrimaryVerifiedEmail(emails: unknown): string | null {
  if (!Array.isArray(emails)) return null;
  const match = emails.find(
    (e): e is { email: string } =>
      !!e &&
      typeof e === "object" &&
      (e as { primary?: unknown }).primary === true &&
      (e as { verified?: unknown }).verified === true &&
      typeof (e as { email?: unknown }).email === "string",
  );
  return match ? match.email : null;
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
