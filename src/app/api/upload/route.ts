import { ok, fail, handleError, getAdminSession, requirePermission } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { uploadImage, isAllowedImageType, MAX_UPLOAD_BYTES } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * POST /api/upload - accepts multipart form-data with a `file` field, stores it
 * in Supabase Storage and returns the public URL.
 *
 * ## Who may upload, and why it is no longer ADMIN alone
 *
 * ⚠️ This was `role === "ADMIN"` only, and that silently broke a feature it was
 * never meant to govern. Posting a desk update on /points requires the
 * `points:manage` PERMISSION, not the admin role - so an editor trusted to
 * publish a post could not upload its cover image. The upload 401'd, the
 * composer showed the error, and the post saved without a photo. "I add a
 * photo and it does not get added" was this, exactly.
 *
 * A permission whose own description is "Post perp DEX & airdrop updates" has
 * to cover the image that goes with the post, or it does not grant what it
 * says. So: ADMIN **or** `points:manage`.
 *
 * This is a deliberate widening of an auth gate, and everything around it is
 * unchanged - the same rate limit, the same allow-list of image types, the same
 * 5 MB ceiling, the same Supabase bucket. It grants uploading to a role that is
 * already trusted to publish content on a public page, which is a narrower
 * thing than it sounds.
 */
export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    // `requirePermission` returns the actor, so this is one extra lookup only
    // for a non-admin - an admin short-circuits on the first check.
    const actor = session ? null : await requirePermission("points:manage");
    if (!session && !actor) return fail("Unauthorized", 401);

    // Keyed per PRINCIPAL (not IP) so shared-NAT/load-balanced editors aren't
    // throttled together and the limit can't be dodged by switching IPs.
    const principalId = session ? (session.user as any).id : (actor as any)?.id;
    const { success } = await rateLimit("admin", `admin-${principalId}`);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return fail("No file provided.", 400);
    if (!isAllowedImageType(file.type)) return fail("Unsupported image type.", 400);
    if (file.size > MAX_UPLOAD_BYTES) return fail("Image is too large (max 5 MB).", 413);

    const result = await uploadImage(await file.arrayBuffer(), file.type);
    if (!result.ok) return fail(result.error, result.status);

    return ok({ url: result.url }, 201);
  } catch (err) {
    return handleError(err, "upload");
  }
}
