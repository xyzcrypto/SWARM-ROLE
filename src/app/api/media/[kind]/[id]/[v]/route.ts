import { prisma } from "@/lib/prisma";
import { handleError, isCuid } from "@/lib/api";
import { parseDataUrl } from "@/lib/media";
import { mediaToken } from "@/lib/utils";
import { rateLimit, clientIp } from "@/lib/ratelimit";

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

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": MISS_CACHE } });

// ── Why `v` is now checked, when it used to be ignored ────────────────────────
// It was documented as "deliberately unused: it exists only to make the URL
// change when the image does". That is what it is FOR, but ignoring it made
// every forged value a distinct URL - and therefore a guaranteed CDN MISS, i.e.
// a function invocation and a DB read per request, from anonymous callers, with
// no upper bound. Measured on production before this change:
//
//   GET /api/media/avatar/<real id>/forged<random>
//   → 200, redirected:false, x-vercel-cache: MISS, 23,776 bytes
//
// A real link already carries the correct token, so verifying it changes nothing
// for legitimate traffic and collapses the cache-key space from unbounded to one
// key per image.
//
// ⚠️ The check CANNOT come before the DB read, and that is inherent, not an
// oversight: the expected token is derived from the stored value (see
// `mediaToken`), so the row has to be in hand to know what to compare against.
// `isCuid` and the rate limiter are what stand in front of the query; the token
// check stands in front of the body and the cache entry.
export async function GET(req: Request, ctx: { params: Promise<{ kind: string; id: string; v: string }> }) {
  try {
    const { kind, id, v } = await ctx.params;
    if (!(kind in KINDS)) return notFound();
    const field = KINDS[kind as Kind];

    // Syntactic, free, and before anything that costs: a bogus id can no longer
    // buy a database round trip.
    if (!isCuid(id)) return notFound();

    // Bounds the residue the token check cannot remove - a valid id with a wrong
    // token still costs an invocation and a query, and 404s are not free at
    // scale. Deliberately generous: legitimate loads are served by the CDN and
    // only ever reach here on a cache miss, so a real visitor makes a handful of
    // these per session, not dozens. Keyed by IP because the route is anonymous
    // and there is no user to key on.
    const { success } = await rateLimit("media", clientIp(req));
    if (!success) return new Response("Too many requests", { status: 429, headers: { "Cache-Control": "private, no-store" } });

    const row = await prisma.user
      .findUnique({ where: { id }, select: { [field]: true } as { image: true } | { bannerImage: true } })
      .catch(() => null);
    const value = (row as Record<string, unknown> | null)?.[field];
    if (typeof value !== "string" || !value) return notFound();

    // Already hosted somewhere real (Supabase Storage, an OAuth avatar, a
    // pasted link) - send the caller there rather than proxying the bytes
    // through a function. `publicImageUrl` normally routes those direct, so
    // this only catches a URL that changed kind after a page was cached.
    //
    // The token is deliberately NOT enforced on this branch. A non-`data:` value
    // has no token to derive - `publicImageUrl` returns it verbatim - so any
    // request arriving here carries one computed from the OLD data: value, and
    // checking it would 404 exactly the stale links this branch exists to
    // rescue. It is also the cheap path: a redirect, no body.
    if (!value.startsWith("data:")) {
      return new Response(null, { status: 307, headers: { Location: value, "Cache-Control": MISS_CACHE } });
    }

    // The expensive path, and the only one with an unbounded cache-key space.
    // A token we did not issue gets a 404 that the CDN may cache briefly, so a
    // repeated forged URL is absorbed at the edge instead of returning here.
    if (v !== mediaToken(value)) return notFound();

    const parsed = parseDataUrl(value);
    if (!parsed) return notFound();

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
