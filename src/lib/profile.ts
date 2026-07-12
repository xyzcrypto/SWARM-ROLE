// Profile validation + helpers. Central zod schemas used by the /api/profile
// routes and shared with the client for consistent rules. Mirrors the style of
// the other route schemas (trim/lowercase/normalize before validating).
import { z } from "zod";

// Handles we never let a user claim - they collide with real routes or are
// reserved for the brand / system accounts.
export const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "root", "system", "support", "help", "api",
  "settings", "account", "login", "logout", "signup", "signin", "register",
  "dashboard", "u", "user", "users", "profile", "me", "research", "about",
  "products", "ecosystem", "community", "xyz", "xyzcrypto", "official",
  "null", "undefined", "anonymous", "mod", "moderator", "staff", "team",
]);

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/**
 * Normalize a raw username input to its canonical form (lowercase, trimmed,
 * `@` stripped). Does not validate - pair with `USERNAME_RE` / the schema.
 */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase().replace(/^@+/, "");
}

/**
 * Reduce a social input to a bare handle: strips a leading `@`, and pulls the
 * last path segment out of a full profile URL (e.g. "https://x.com/foo" -> "foo").
 * Returns "" for empty input.
 */
export function normalizeHandle(input: string): string {
  let v = input.trim();
  if (!v) return "";
  // For a full profile URL, the handle is the LAST non-empty path segment - this
  // handles `/in/slug` (LinkedIn) and `/@handle` (YouTube) as well as the simple
  // `/handle` case (x.com/foo, github.com/bar, t.me/baz).
  const urlMatch = v.match(/^https?:\/\/[^\s/]+\/(.+)$/i);
  if (urlMatch) {
    const path = urlMatch[1]!.replace(/[?#].*$/, ""); // drop query/hash first
    const segs = path.split("/").filter(Boolean);
    v = segs.length ? segs[segs.length - 1]! : "";
  }
  v = v.replace(/[/?#].*$/, ""); // bare "bar/extra" -> "bar"
  v = v.replace(/^@+/, ""); // drop leading @
  return v.trim();
}

const usernameField = z
  .string()
  .trim()
  .transform(normalizeUsername)
  .refine((v) => USERNAME_RE.test(v), {
    message: "Handle must be 3-20 characters: lowercase letters, numbers or _.",
  })
  .refine((v) => !RESERVED_USERNAMES.has(v), { message: "That handle is reserved." });

// Bare social handle: optional, normalized, conservative character set.
const handleField = z
  .string()
  .trim()
  .transform(normalizeHandle)
  .refine((v) => v === "" || /^[A-Za-z0-9_.-]{1,40}$/.test(v), {
    message: "Use a valid handle (letters, numbers, _ . or -).",
  })
  // Empty string -> undefined so it clears the column.
  .transform((v) => (v === "" ? undefined : v))
  .optional();

// Hosts allowed for an externally-pasted avatar URL. MUST stay in sync with the
// next/image `remotePatterns` in next.config.mjs - otherwise next/image refuses
// to render the avatar. Used by the profile schema's optional `image` field
// (the URL fallback for when Supabase Storage uploads aren't configured).
const ALLOWED_IMAGE_HOST_SUFFIXES = [
  ".unsplash.com",
  ".googleusercontent.com",
  ".githubusercontent.com",
  "res.cloudinary.com",
  ".supabase.co",
];

export function isAllowedImageHost(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_IMAGE_HOST_SUFFIXES.some(
      (s) => host === s.replace(/^\./, "") || host.endsWith(s)
    );
  } catch {
    return false;
  }
}

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((v) => (v === "" ? undefined : v))
    .optional();

// PATCH /api/profile body. All fields optional so the form can send partials.
export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name cannot be empty.")
    .max(60, "Name must be 60 characters or fewer.")
    .optional(),
  username: usernameField.optional(),
  // Avatar URL fallback (when Supabase Storage isn't configured). Must be an
  // https URL from an allowlisted host so next/image can render it.
  image: z
    .string()
    .trim()
    .max(2048)
    .refine((v) => v === "" || isAllowedImageHost(v), {
      message:
        "Use an https image URL from a supported host (Unsplash, Cloudinary, GitHub, Google, or Supabase).",
    })
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
  // Profile cover/banner image URL (same allowlist + rules as the avatar URL).
  bannerImage: z
    .string()
    .trim()
    .max(2048)
    .refine((v) => v === "" || isAllowedImageHost(v), {
      message:
        "Use an https image URL from a supported host (Unsplash, Cloudinary, GitHub, Google, or Supabase).",
    })
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
  bio: optionalText(500, "Bio"),
  location: optionalText(80, "Location"),
  website: z
    .string()
    .trim()
    .max(120)
    .url("Enter a valid URL (including https://).")
    .transform((v) => (v === "" ? undefined : v))
    .optional()
    .or(z.literal("").transform(() => undefined)),
  twitter: handleField,
  github: handleField,
  telegram: handleField,
  discord: handleField,
  youtube: handleField,
  linkedin: handleField,
  instagram: handleField,
});

export type ProfileInput = z.infer<typeof profileSchema>;

/**
 * Shared strong-password policy, used by signup, password reset and password
 * change so the rules are enforced server-side everywhere (the client strength
 * meter in PasswordField is only UI feedback). Min 8 with a mix of cases + a
 * digit - a reasonable bar that resists casual brute-force without frustrating
 * users. Keep messages specific so the form can guide the user.
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(100, "Password is too long.")
  .refine((v) => /[a-z]/.test(v), { message: "Add a lowercase letter." })
  .refine((v) => /[A-Z]/.test(v), { message: "Add an uppercase letter." })
  .refine((v) => /\d/.test(v), { message: "Add a number." });

// POST /api/profile/password body.
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: passwordSchema,
});

// GET /api/profile/username?handle= - availability check input.
export const usernameQuerySchema = z.object({ handle: usernameField });
