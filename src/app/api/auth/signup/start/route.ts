import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { issueCode } from "@/lib/otp";
import { sendEmail, otpEmail } from "@/lib/email";
import { emailEnabled } from "@/lib/env";
import { passwordSchema } from "@/lib/profile";

const schema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: passwordSchema,
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

    // Second, per-email limit alongside the IP-keyed one above - an attacker
    // rotating IPs can still only email-bomb one target this many times.
    const emailLimit = await rateLimit("otpEmail", email);
    if (!emailLimit.success) return fail("Too many attempts. Please try again shortly.", 429);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Don't reveal whether an email is registered (user enumeration - login
      // and password-reset are already generic). Respond exactly like success;
      // the real owner gets a notice instead of a code.
      const subject = "You already have an XYZ Crypto account";
      const text =
        "Someone (probably you) tried to sign up with this email, but an account already exists. " +
        "Just log in - or use “Forgot password” if you can't get in. If this wasn't you, you can ignore this email.";
      await sendEmail(email, subject, `<p>${text}</p>`, text).catch(() => null);
      return ok({ ok: true });
    }

    const passwordHash = await bcrypt.hash(password, 12);
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
