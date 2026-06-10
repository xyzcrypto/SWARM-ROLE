import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { issueCode } from "@/lib/otp";
import { sendEmail, otpEmail } from "@/lib/email";
import { emailEnabled } from "@/lib/env";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password").max(100),
});

// POST /api/auth/login/start — verify email + password, then email a 2FA code.
// The session is only created after the code is verified (NextAuth authorize).
export async function POST(req: Request) {
  try {
    const { success } = await rateLimit("signup", clientIp(req));
    if (!success) return fail("Too many attempts. Please try again shortly.", 429);

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    // Generic message — never reveal whether the email exists.
    if (!user || !user.passwordHash) return fail("Invalid email or password.", 401);
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return fail("Invalid email or password.", 401);

    const code = await issueCode(email, "login");
    const { subject, html, text } = otpEmail(code, "login");
    await sendEmail(email, subject, html, text);

    return ok({
      ok: true,
      ...(!emailEnabled && process.env.NODE_ENV !== "production" ? { devCode: code } : {}),
    });
  } catch (err) {
    return handleError(err, "login:start");
  }
}
