import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError } from "@/lib/api";
import { getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import bcrypt from "bcryptjs";
import { z } from "zod";
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
  dmPrivacy: true,
  profileVisibility: true,
} as const;

// GET /api/profile - the signed-in user's own profile, image fields as stored
// (an inline data: URL is returned verbatim). Private, self-only, no-store.
//
// The profile PAGE no longer calls this: public pages now serve a real
// /api/media/... URL that works for every viewer, so there is nothing to
// "rehydrate" for the owner (see publicImageUrl). It remains the settings
// editor's read, where showing the current image in the form is the point and
// one private request for it is fine.
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
// Requires { confirm: true }, plus { password } when the account has one.
export async function DELETE(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);

    const { success } = await rateLimit("profile", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = z.object({ confirm: z.literal(true), password: z.string().max(200).optional() }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Deletion not confirmed.", 400);

    // Re-authenticate before an irreversible delete (audit F-11): a stolen
    // session cookie alone (a shared device, a borrowed laptop) used to be
    // enough to wipe the account. Accounts with a password must type it;
    // OAuth-only accounts have no password to ask for.
    const acct = await prisma.user.findUnique({ where: { id: me.id }, select: { passwordHash: true } });
    if (acct?.passwordHash) {
      // Same per-account budget as password changes, so this cannot be used
      // to guess the password.
      if (!(await rateLimit("password", `delete:${me.id}`)).success) return fail("Too many attempts. Please try again shortly.", 429);
      if (!parsed.data.password || !(await bcrypt.compare(parsed.data.password, acct.passwordHash))) {
        return fail("That password is not right.", 403);
      }
    }

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
