import { prisma } from "@/lib/prisma";
import { handleError } from "@/lib/api";
import { parseDataUrl } from "@/lib/media";

export const runtime = "nodejs";

/**
 * GET /api/media/avatar/<userId>/<token>
 * GET /api/media/banner/<userId>/<token>
 *
 * Serves a profile image that is stored in the database as an inline `data:`
 * URL, as real image bytes at a real URL.
 *
 * ## Why this exists
 *
 * `uploadImage()` falls back to base64-in-the-database whenever Supabase
 * Storage is unconfigured or fails, so uploads work with zero setup. That part
 * is fine. What was not fine is what every read path then did with it:
 * `stripInlineImage()` replaced the value with `null` before serving it, to keep
 * a 700KB blob out of hot JSON payloads and out of ISR-cached HTML.
 *
 * The result, from the user's side: **you upload a profile photo, it saves, and
 * it never appears anywhere** - not on your profile, not in chat, not in
 * comments, not to anyone else. The photo was in the database the whole time.
 * The banner had a patch for this (an owner-only re-fetch), which meant the
 * owner saw their own banner and nobody else did; the avatar had no patch at
 * all.
 *
 * Serving it here fixes that for everyone, and is *better* for egress than
 * either previous behaviour: the bytes leave the origin once and are then held
 * by the CDN, instead of being re-serialized into every JSON response and every
 * ISR cache fill (the original problem) - or not being served at all.
 *
 * ## Caching
 *
 * The trailing token is derived from the stored value (see `publicImageUrl`),
 * so a new upload produces a new URL: a changed photo is a cache miss on a
 * different key rather than a stale hit on this one. That is what lets the
 * window be long without a photo change taking a month to appear.
 *
 * It is a path SEGMENT, not a query parameter, and that is not cosmetic.
 * `next/image` refuses to optimize a local URL that carries a query string
 * unless `images.localPatterns` is configured to allow it - it answers
 * `400 "url" parameter is not allowed`, and the avatar renders as a 0x0 broken
 * image. Measured, with `?v=`: every `<Image>` on the site pointing here was
 * blank. Putting the token in the path keeps the default (safe) image config
 * untouched and still busts the cache.
 */
const KINDS = { avatar: "image", banner: "bannerImage" } as const;
type Kind = keyof typeof KINDS;

// Long, but finite, and deliberately NOT `immutable`.
//
// The version token is a cheap sample of the stored value rather than a hash (see
// `publicImageUrl` - hashing hundreds of KB per row on hot endpoints is real
// billable CPU), so it is overwhelmingly likely, not guaranteed, to change when
// the image does. `immutable` for a year would turn the one-in-astronomical
// case into a permanently stuck avatar with no way out. A month at the edge
// still means about one origin fetch per image, and any freak collision heals
// on its own.
const CACHE = "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400";
// A miss (no user, no image) must not be cached for a year - the user may be
// about to upload one. Short and revalidating.
const MISS_CACHE = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";

// `v` is deliberately unused: it exists only to make the URL change when the
// image does, so a long cache window can never mask a new upload.
export async function GET(_req: Request, ctx: { params: Promise<{ kind: string; id: string; v: string }> }) {
  try {
    const { kind, id } = await ctx.params;
    if (!(kind in KINDS)) return new Response("Not found", { status: 404, headers: { "Cache-Control": MISS_CACHE } });
    const field = KINDS[kind as Kind];

    const row = await prisma.user
      .findUnique({ where: { id }, select: { [field]: true } as { image: true } | { bannerImage: true } })
      .catch(() => null);
    const value = (row as Record<string, unknown> | null)?.[field];
    if (typeof value !== "string" || !value) {
      return new Response("Not found", { status: 404, headers: { "Cache-Control": MISS_CACHE } });
    }

    // Already hosted somewhere real (Supabase Storage, an OAuth avatar, a
    // pasted link) - send the caller there rather than proxying the bytes
    // through a function. `publicImageUrl` normally routes those direct, so
    // this only catches a URL that changed kind after a page was cached.
    if (!value.startsWith("data:")) {
      return new Response(null, { status: 307, headers: { Location: value, "Cache-Control": MISS_CACHE } });
    }

    const parsed = parseDataUrl(value);
    if (!parsed) return new Response("Not found", { status: 404, headers: { "Cache-Control": MISS_CACHE } });

    return new Response(new Uint8Array(parsed.body), {
      status: 200,
      headers: {
        "Content-Type": parsed.mime,
        "Content-Length": String(parsed.body.byteLength),
        "Cache-Control": CACHE,
        // These are public profile images - the same bytes every viewer sees -
        // so there is nothing here to vary on.
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return handleError(err, "media");
  }
}
