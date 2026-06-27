import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, requirePermission } from "@/lib/api";
import { isAdminEmail } from "@/lib/env";

export const dynamic = "force-dynamic";

// GET /api/users/staff — everyone who currently has access: members with >=1
// capability, plus Super Admins (role ADMIN / ADMIN_EMAILS). Gated by `users:roles`.
export async function GET() {
  try {
    const actor = await requirePermission("users:roles");
    if (!actor) return fail("Forbidden", 403);

    let rows: Array<{ id: string; email: string; name: string | null; role: string; permissions?: string[] }>;
    try {
      rows = await prisma.user.findMany({
        where: { OR: [{ role: "ADMIN" }, { permissions: { isEmpty: false } }] },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { id: true, email: true, name: true, role: true, permissions: true },
      });
    } catch (e) {
      // Pre-migration (no permissions column) → list Super Admins only.
      if ((e as { code?: string })?.code !== "P2022") throw e;
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN" },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { id: true, email: true, name: true, role: true },
      });
      rows = admins.map((r) => ({ ...r, permissions: [] }));
    }

    const users = rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      permissions: u.permissions ?? [],
      isSuperAdmin: isAdminEmail(u.email) || u.role === "ADMIN",
    }));
    return ok({ users });
  } catch (err) {
    return handleError(err, "users:staff");
  }
}
