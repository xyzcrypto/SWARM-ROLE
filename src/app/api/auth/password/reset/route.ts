import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { verifyCode } from "@/lib/otp";
import { passwordSchema } from "@/lib/profile";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  password: passwordSchema,
});

// POST /api/auth/password/reset - verify the reset code and set a new password.
export async function POST(req: Request) {
  try {
    const { success } = await rateLimit("password", clientIp(req));
    if (!success) return fail("Too many attempts. Please try again shortly.", 429);

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const { email, code, password } = parsed.data;

    const result = await verifyCode(email, "reset", code);
    if (!result.ok) return fail(result.error, 400);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return fail("Account not found.", 404);

    const passwordHash = await bcrypt.hash(password, 12);
    // Clear brute-force lockout state atomically with the password change: a user
    // who locked their account by guessing before resetting must be able to sign in
    // with the new password immediately, not wait out the lock window.
    await prisma.user.update({
      where: { email },
      // `passwordChangedAt` revokes every session issued before this moment - see
      // the `pwdAt` check in core/auth/auth.ts. Without it, resetting the password
      // rotated the hash but left existing JWTs valid for the full 30-day session
      // lifetime, so the one action a user takes specifically to lock an intruder
      // out did not do that.
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null, passwordChangedAt: new Date() },
    });

    return ok({ ok: true });
  } catch (err) {
    return handleError(err, "password:reset");
  }
}
