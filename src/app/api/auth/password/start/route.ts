import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handleError, fail } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { issueCode } from "@/lib/otp";
import { sendEmail, otpEmail } from "@/lib/email";
import { emailEnabled } from "@/lib/env";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

// POST /api/auth/password/start — begin a password reset. Always returns a
// generic success (never leaks whether the email exists); only sends a code
// when a credentials account actually exists.
export async function POST(req: Request) {
  try {
    const { success } = await rateLimit("signup", clientIp(req));
    if (!success) return fail("Too many attempts. Please try again shortly.", 429);

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid email", 400);
    }
    const { email } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    let devCode: string | undefined;
    if (user && user.passwordHash) {
      const code = await issueCode(email, "reset");
      const { subject, html, text } = otpEmail(code, "reset");
      await sendEmail(email, subject, html, text);
      if (!emailEnabled && process.env.NODE_ENV !== "production") devCode = code;
    }

    return ok({ ok: true, ...(devCode ? { devCode } : {}) });
  } catch (err) {
    return handleError(err, "password:start");
  }
}
