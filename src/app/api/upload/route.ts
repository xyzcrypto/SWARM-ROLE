import { ok, fail, handleError, getAdminSession } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { uploadImage, isAllowedImageType, MAX_UPLOAD_BYTES } from "@/lib/storage";

export const runtime = "nodejs";

// POST /api/upload - admin only. Accepts multipart form-data with a `file`
// field, stores it in Supabase Storage and returns the public URL.
export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return fail("Unauthorized", 401);

    const { success } = await rateLimit("admin", clientIp(req));
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
