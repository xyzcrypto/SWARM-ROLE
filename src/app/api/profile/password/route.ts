import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { passwordChangeSchema } from "@/lib/profile";

// POST /api/profile/password - change password for credentials accounts.
// Requires the current password; OAuth-only accounts (no passwordHash) are
// directed to set a password via the reset flow instead.
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);

    const { success } = await rateLimit("login", me.id);
    if (!success) return fail("Too many attempts. Please try again shortly.", 429);

    const parsed = passwordChangeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: me.id },
      select: { passwordHash: true },
    });
    if (!user?.passwordHash) {
      return fail("Your account signs in with Google. Use 'Forgot password' to set one.", 400);
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return fail("Current password is incorrect.", 400);

    const passwordHash = await bcrypt.hash(newPassword, 12);
    // Same revocation as the forgot-password path (api/auth/password/reset). See
    // `pwdAt` in core/auth/auth.ts.
    //
    // Note this signs out EVERY session including the caller's own, so the user
    // has to sign in again straight after changing their password. That is the
    // deliberate choice: the alternative is exempting the current token, which
    // means a request carrying the token has to be trusted to say which token it
    // is - and the whole point here is that a token may be in the wrong hands.
    // "Changed your password? Sign in again" is the common, comprehensible
    // behaviour; silently keeping one session alive is not.
    await prisma.user.update({
      where: { id: me.id },
      data: { passwordHash, passwordChangedAt: new Date() },
    });

    return ok({ ok: true });
  } catch (err) {
    return handleError(err, "profile:password");
  }
}
