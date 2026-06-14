import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { usernameQuerySchema } from "@/lib/profile";

// GET /api/profile/username?handle=foo - is this handle available for me?
// Returns { available, handle, reason? }. The user's own current handle counts
// as available so the form doesn't flag it while editing.
export async function GET(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);

    const handle = new URL(req.url).searchParams.get("handle") ?? "";
    const parsed = usernameQuerySchema.safeParse({ handle });
    if (!parsed.success) {
      return ok({
        available: false,
        handle,
        reason: parsed.error.issues[0]?.message ?? "Invalid handle.",
      });
    }

    const existing = await prisma.user.findUnique({
      where: { username: parsed.data.handle },
      select: { id: true },
    });
    const available = !existing || existing.id === me.id;
    return ok({
      available,
      handle: parsed.data.handle,
      ...(available ? {} : { reason: "That handle is already taken." }),
    });
  } catch (err) {
    return handleError(err, "profile:username");
  }
}
