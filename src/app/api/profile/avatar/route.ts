import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { uploadImage, isAllowedImageType, MAX_UPLOAD_BYTES } from "@/lib/storage";

// POST /api/profile/avatar - any signed-in user uploads a new profile picture.
// Reuses the same Supabase storage path as cover uploads; persists the URL to
// the user's `image` so it shows everywhere (navbar, profile, comments).
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);

    const { success } = await rateLimit("profile", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return fail("No file provided.", 400);
    if (!isAllowedImageType(file.type)) return fail("Unsupported image type.", 400);
    if (file.size > MAX_UPLOAD_BYTES) return fail("Image is too large (max 5 MB).", 413);

    const result = await uploadImage(await file.arrayBuffer(), file.type);
    if (!result.ok) return fail(result.error, result.status);

    const user = await prisma.user.update({
      where: { id: me.id },
      data: { image: result.url },
      select: { username: true },
    });
    // Bust the ISR-cached public profile so the new photo shows immediately.
    if (user.username) revalidatePath(`/u/${user.username}`);

    return ok({ url: result.url }, 201);
  } catch (err) {
    return handleError(err, "profile:avatar");
  }
}
