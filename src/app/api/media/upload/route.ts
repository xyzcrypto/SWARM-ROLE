import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { uploadImage, isAllowedImageType, MAX_UPLOAD_BYTES } from "@/lib/storage";

export const runtime = "nodejs";

// POST /api/media/upload - any signed-in member uploads an image (for DM photos).
// Rate-limited. Returns the stored public URL. Falls back to an inline data URL
// when Storage isn't configured (caller decides if that fits their size limit).
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);

    const { success } = await rateLimit("comment", me.id);
    if (!success) return fail("Too many uploads. Please slow down.", 429);

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return fail("No file provided.", 400);
    if (!isAllowedImageType(file.type)) return fail("Unsupported image type.", 400);
    if (file.size > MAX_UPLOAD_BYTES) return fail("Image is too large (max 5 MB).", 413);

    const result = await uploadImage(await file.arrayBuffer(), file.type);
    if (!result.ok) return fail(result.error, result.status);

    return ok({ url: result.url }, 201);
  } catch (err) {
    return handleError(err, "media:upload");
  }
}
