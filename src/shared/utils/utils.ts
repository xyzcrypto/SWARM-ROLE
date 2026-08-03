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

// `timeZone: "UTC"` on all three is load-bearing, not a formatting preference.
//
// These render inside server-rendered surfaces (research posts, profiles,
// settings, the dashboard). Pinning only the LOCALE still leaves the timezone
// to the runtime - Vercel runs UTC, the reader's browser does not - so a
// timestamp near midnight formatted to a different calendar day on each side.
// Measured on /settings from an IST browser: the server sent "Aug 2, 2026" and
// the client rendered "Aug 3, 2026", a text mismatch, which React treats as a
// hard hydration failure (#418) and recovers from by re-rendering the subtree.
//
// UTC is also the better answer on its own terms here: these are "published
// on" / "joined on" stamps, and a post should not appear to have been
// published on different days to different readers. Where a date genuinely
// means "the viewer's day" - the chat's Today/Yesterday separators - the local
// timezone is correct and the fix is to format it after hydration instead.
// (`DashboardClient` already pinned UTC for exactly this reason.)
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "Mon, Jul 14" - date with weekday, for trade logs where the day matters. */
export function formatDateWithDay(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(date: Date | string | null): string {
  if (!date) return "Never";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
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
 * Turn a stored profile image into something a browser can actually load.
 *
 * This replaces `stripInlineImage` at every read path, and the difference is
 * the whole bug: stripping returned `null`, so an uploaded photo was silently
 * discarded on the way out and **never appeared for anyone** - the uploader
 * included. The bytes were in the database the entire time.
 *
 * - Already a real URL (Supabase Storage, an OAuth avatar, a pasted link):
 *   returned untouched.
 * - An inline `data:` URL: rewritten to `/api/media/<kind>/<ownerId>/<token>`,
 *   which serves the same bytes with a long CDN cache. That keeps the blob out
 *   of JSON payloads and ISR HTML - the Fast Origin Transfer problem stripping
 *   was introduced for - while still showing the photo, because the CDN answers
 *   every request after the first.
 * - No owner id to build a URL from: falls back to null, i.e. the old
 *   behaviour, so a caller that cannot supply one degrades rather than breaks.
 *
 * The trailing token exists so a new upload lands on a different URL instead
 * of being masked by the previous image's cache entry. It is a path segment
 * rather than `?v=` because `next/image` refuses to optimize a local URL with
 * a query string under the default config (`400 "url" parameter is not
 * allowed`), which rendered every avatar as a 0x0 broken image.
 *
 * It samples the value rather than hashing it, deliberately: these paths run per
 * row on hot endpoints and the value can be several hundred KB of base64, so a
 * real hash there is genuine synchronous CPU on a plan that bills for exactly
 * that. Length plus three fixed windows (head, middle, tail) is O(1) and cannot
 * realistically match across two different photos - a different image differs
 * throughout its base64, not only in one place. The first version of this used
 * length + tail alone, and a unit test caught it: an edit near the *start* of
 * the data left the token identical, which would have pinned a stale avatar.
 * The route's cache window is finite for the same reason - see its header - so
 * even a freak collision self-heals rather than sticking forever.
 */
export function publicImageUrl(
  url: string | null | undefined,
  ownerId: string | null | undefined,
  kind: "avatar" | "banner" = "avatar"
): string | null {
  if (typeof url !== "string" || !url) return null;
  if (!url.startsWith("data:")) return url;
  if (!ownerId) return null;
  const mid = Math.floor(url.length / 2);
  const sample = url.slice(24, 30) + url.slice(mid, mid + 6) + url.slice(-6);
  const token = url.length.toString(36) + sample.replace(/[^a-zA-Z0-9]/g, "");
  return `/api/media/${kind}/${encodeURIComponent(ownerId)}/${token}`;
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
