import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError } from "@/lib/api";
import { getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { profileSchema } from "@/lib/profile";

// Fields returned to the client after an update (safe, no secrets).
const PUBLIC_SELECT = {
  id: true,
  name: true,
  username: true,
  image: true,
  bannerImage: true,
  bio: true,
  location: true,
  website: true,
  twitter: true,
  github: true,
  telegram: true,
} as const;

// GET /api/profile - the signed-in user's own profile, image fields unstripped.
// The public /u/[username] page strips inline data: URL avatars/banners before
// they reach its ISR-cached HTML (see stripInlineImage - FOT protection for
// every visitor), so an owner whose upload fell back to an inline data: URL
// otherwise never sees it on their own page. This is a private, self-only,
// no-store read that lets the owner's view rehydrate with the real image.
export async function GET() {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);

    const user = await prisma.user.findUnique({ where: { id: me.id }, select: PUBLIC_SELECT });
    if (!user) return fail("Not found.", 404);

    return NextResponse.json({ user }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return handleError(err, "profile:get");
  }
}

// PATCH /api/profile - update the signed-in user's profile (partial).
export async function PATCH(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);

    const { success } = await rateLimit("profile", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = profileSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }

    // Only write keys the user actually sent (so blanks don't wipe other fields).
    const data = parsed.data;
    try {
      const before = await prisma.user.findUnique({
        where: { id: me.id },
        select: { username: true },
      });
      const user = await prisma.user.update({
        where: { id: me.id },
        data,
        select: PUBLIC_SELECT,
      });
      // The public profile is ISR-cached (60s) - bust it so edits show instantly,
      // including the old handle's page when the handle changed.
      if (user.username) revalidatePath(`/u/${user.username}`);
      if (before?.username && before.username !== user.username) {
        revalidatePath(`/u/${before.username}`);
      }
      return ok({ user });
    } catch (err: any) {
      // Unique handle collision -> friendly message.
      if (err?.code === "P2002") return fail("That handle is already taken.", 409);
      throw err;
    }
  } catch (err) {
    return handleError(err, "profile:update");
  }
}

// DELETE /api/profile - permanently delete the signed-in user's account.
// Requires a JSON body { confirm: true } to avoid accidental deletes.
export async function DELETE(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);

    const { success } = await rateLimit("profile", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== true) return fail("Deletion not confirmed.", 400);

    // Remove the user's own content/relations, then the account itself.
    // Account/Session rows cascade on user delete; authored Posts are detached
    // (authorId -> null via onDelete: SetNull) so published content survives.
    await prisma.$transaction([
      prisma.postLike.deleteMany({ where: { userId: me.id } }),
      prisma.comment.deleteMany({ where: { userId: me.id } }),
      prisma.user.delete({ where: { id: me.id } }),
    ]);

    return ok({ ok: true });
  } catch (err) {
    return handleError(err, "profile:delete");
  }
}
