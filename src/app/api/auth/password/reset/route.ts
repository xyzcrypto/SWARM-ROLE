import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { verifyCode } from "@/lib/otp";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});

// POST /api/auth/password/reset — verify the reset code and set a new password.
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

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { email }, data: { passwordHash } });

    return ok({ ok: true });
  } catch (err) {
    return handleError(err, "password:reset");
  }
}
