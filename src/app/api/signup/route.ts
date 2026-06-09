import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError } from "@/lib/api";
import { isAdminEmail } from "@/lib/env";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const schema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});

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
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        provider: "credentials",
        role: isAdminEmail(email) ? "ADMIN" : "USER",
      },
    });

    return ok({ ok: true }, 201);
  } catch (err) {
    return handleError(err, "signup");
  }
}
