import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, requirePermission } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { isAdminEmail } from "@/lib/env";

export const dynamic = "force-dynamic";

// GET /api/users/search?q= — find any member by email or name for the Access
// editor (requires `users:roles`). Empty q returns the most recent members.
export async function GET(req: Request) {
  try {
    const actor = await requirePermission("users:roles");
    if (!actor) return fail("Forbidden", 403);

    const { success } = await rateLimit("admin", clientIp(req));
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 120);
    const where: Prisma.UserWhereInput = q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};

    const base = { where, take: 20, orderBy: { createdAt: "desc" as const } };

    // Include `permissions`, but tolerate a not-yet-migrated DB (no column).
    let rows: Array<{ id: string; email: string; name: string | null; role: string; permissions?: string[] }>;
    try {
      rows = await prisma.user.findMany({
        ...base,
        select: { id: true, email: true, name: true, role: true, permissions: true },
      });
    } catch (e) {
      if ((e as { code?: string })?.code !== "P2022") throw e;
      const noPerms = await prisma.user.findMany({
        ...base,
        select: { id: true, email: true, name: true, role: true },
      });
      rows = noPerms.map((r) => ({ ...r, permissions: [] }));
    }

    const users = rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      permissions: u.permissions ?? [],
      isSuperAdmin: isAdminEmail(u.email) || u.role === "ADMIN",
    }));

    return ok({ users });
  } catch (err) {
    return handleError(err, "users:search");
  }
}
