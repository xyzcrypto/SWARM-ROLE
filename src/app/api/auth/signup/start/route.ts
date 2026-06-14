import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { issueCode } from "@/lib/otp";
import { sendEmail, otpEmail } from "@/lib/email";
import { emailEnabled } from "@/lib/env";

const schema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});

// POST /api/auth/signup/start - validate details, email a verification code.
// The account is created only after the code is verified (in NextAuth authorize).
export async function POST(req: Request) {
  try {
    const { success } = await rateLimit("signup", clientIp(req));
    if (!success) return fail("Too many attempts. Please try again shortly.", 429);

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return fail("An account with this email already exists.", 409);

    const passwordHash = await bcrypt.hash(password, 10);
    const code = await issueCode(email, "signup", { name, passwordHash });
    const { subject, html, text } = otpEmail(code, "signup");
    const sent = await sendEmail(email, subject, html, text);
    if (!sent.ok) {
      return fail("We couldn't send the verification email. Please try again shortly.", 502);
    }

    return ok({
      ok: true,
      ...(!emailEnabled && process.env.NODE_ENV !== "production" ? { devCode: code } : {}),
    });
  } catch (err) {
    return handleError(err, "signup:start");
  }
}
