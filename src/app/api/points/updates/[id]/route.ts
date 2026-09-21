import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, requirePermission, isCuid } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { broadcastEvent, CH_POINTS } from "@/lib/realtime";
import { UPDATE_KINDS, UPDATE_LIMITS, safeUrl } from "@modules/points/lib/points-updates";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().trim().min(3).max(UPDATE_LIMITS.title).optional(),
  body: z.string().trim().min(3).max(UPDATE_LIMITS.body).optional(),
  kind: z.enum(UPDATE_KINDS as unknown as [string, ...string[]]).optional(),
  program: z.string().trim().max(60).nullable().optional(),
  url: z.string().trim().max(500).nullable().optional(),
  // ⚠️ `image` was missing, so an edit could change every field EXCEPT the
  // cover - silently, because zod strips unknown keys rather than refusing
  // them. The author would remove an image, see the composer close, and find
  // it still there.
  image: z.string().trim().max(500).nullable().optional(),
  pinned: z.boolean().optional(),
  published: z.boolean().optional(),
});

// PATCH /api/points/updates/<id> - edit (requires `points:manage`).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("points:manage");
    if (!actor) return fail("Forbidden", 403);
    const { success } = await rateLimit("admin", clientIp(req));
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const { id } = await ctx.params;
    // Validate the shape before touching the DB - a non-cuid can only ever be
    // a 404, and checking here saves the round trip.
    if (!isCuid(id)) return fail("Not found.", 404);

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);

    const data: Record<string, unknown> = { ...parsed.data };
    if ("url" in parsed.data) {
      const url = safeUrl(parsed.data.url ?? null);
      if (parsed.data.url?.trim() && !url) return fail("Link must be a http(s) URL.", 400);
      data.url = url;
    }
    if ("program" in parsed.data) data.program = parsed.data.program?.trim() || null;
    // Same gate the POST uses: an image src is a URL the browser fetches, and
    // it goes through `safeUrl` rather than being trusted because it came from
    // an authenticated editor.
    if ("image" in parsed.data) data.image = safeUrl(parsed.data.image ?? null);

    const row = await prisma.pointsUpdate.update({ where: { id }, data });
    // Broadcast on any edit to a published row, not only on create: fixing a
    // wrong date or unpinning something is exactly the kind of change a reader
    // with the page open needs to see.
    if (row.published) await broadcastEvent(CH_POINTS, "points_update", { id: row.id });
    return ok({ id: row.id });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2025") return fail("Not found.", 404);
    return handleError(err, "points:updates:patch");
  }
}

// DELETE /api/points/updates/<id> (requires `points:manage`).
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("points:manage");
    if (!actor) return fail("Forbidden", 403);
    const { success } = await rateLimit("admin", clientIp(req));
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const { id } = await ctx.params;
    if (!isCuid(id)) return fail("Not found.", 404);

    await prisma.pointsUpdate.delete({ where: { id } });
    // A removed update changes the feed for everyone, so it broadcasts too -
    // otherwise an open page keeps showing something that no longer exists.
    await broadcastEvent(CH_POINTS, "points_update", { id });
    return ok({ id });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2025") return fail("Not found.", 404);
    return handleError(err, "points:updates:delete");
  }
}
