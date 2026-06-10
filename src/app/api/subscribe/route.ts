import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  source: z.string().trim().max(40).optional(),
});

// POST /api/subscribe — public, one-field email capture (idempotent)
export async function POST(req: Request) {
  try {
    const { success } = await rateLimit("subscribe", clientIp(req));
    if (!success) return fail("Too many attempts. Please try again shortly.", 429);

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid email", 400);
    }
    const { email, source } = parsed.data;

    await prisma.subscriber.upsert({
      where: { email },
      update: {},
      create: { email, source: source || "website" },
    });

    return ok({ ok: true });
  } catch (err) {
    return handleError(err, "subscribe");
  }
}
