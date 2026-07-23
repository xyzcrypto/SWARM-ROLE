import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, requirePermission, isCuid } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { broadcastEvent, userChannel } from "@/lib/realtime";
import { sanitizePermissions, hasPermission, isSuperAdmin } from "@/lib/permissions";
import { isAdminEmail } from "@/lib/env";

const schema = z.object({ permissions: z.array(z.string()).max(50) });

// GET /api/users/:id/access - current capabilities for the access editor.
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const actor = await requirePermission("users:roles");
    if (!actor) return fail("Forbidden", 403);
    if (!isCuid(params.id)) return fail("Invalid id.", 400);
    const target = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, email: true, role: true, permissions: true },
    });
    if (!target) return fail("User not found.", 404);
    return ok({
      id: target.id,
      permissions: target.permissions ?? [],
      isSuperAdmin: isAdminEmail(target.email) || target.role === "ADMIN",
    });
  } catch (err) {
    return handleError(err, "users:access:get");
  }
}

// PATCH /api/users/:id/access - set a member's staff capabilities.
// Gated by `users:roles`; Super Admins (ADMIN_EMAILS) are immutable here.
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const actor = await requirePermission("users:roles");
    if (!actor) return fail("Forbidden", 403);

    const { success } = await rateLimit("admin", clientIp(req));
    if (!success) return fail("Too many requests. Please slow down.", 429);

    if (!isCuid(params.id)) return fail("Invalid id.", 400);

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid permissions.", 400);
    const requested = sanitizePermissions(parsed.data.permissions);

    const target = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, email: true, role: true },
    });
    if (!target) return fail("User not found.", 404);

    // Super Admins' access is env-based (ADMIN_EMAILS) and not editable here.
    if (isAdminEmail(target.email) || target.role === "ADMIN") {
      return fail("This account is a Super Admin; its access is managed via ADMIN_EMAILS.", 409);
    }
    // No self-escalation: a non-super grantor can't edit their own access.
    if (target.id === actor.id && !isSuperAdmin(actor)) {
      return fail("You can't change your own permissions.", 409);
    }
    // No privilege escalation: you can only grant capabilities you hold yourself
    // (Super Admins hold all, so they can grant anything).
    const cannotGrant = requested.filter((p) => !hasPermission(actor, p));
    if (cannotGrant.length) {
      return fail(`You can't grant capabilities you don't hold: ${cannotGrant.join(", ")}.`, 403);
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { permissions: requested },
      select: { id: true, permissions: true },
    });

    // Append-only audit trail (best-effort).
    await prisma.adminAudit
      .create({
        data: {
          actorId: actor.id,
          action: "access.update",
          targetId: target.id,
          detail: JSON.stringify({ permissions: requested }),
        },
      })
      .catch(() => null);

    // Push the change so the target's session refreshes its capabilities live.
    await broadcastEvent(userChannel(updated.id), "access_changed", { permissions: updated.permissions });

    return ok({ user: updated });
  } catch (err) {
    return handleError(err, "users:access");
  }
}
