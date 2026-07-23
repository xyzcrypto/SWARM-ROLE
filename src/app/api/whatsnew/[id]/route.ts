import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, requirePermission, isCuid } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { broadcastEvent, CH_NOTIFY } from "@/lib/realtime";
import { WHATS_NEW_TAGS } from "@/lib/whatsnew";

const patchSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  body: z.string().trim().min(3).max(1000).optional(),
  tag: z.enum(WHATS_NEW_TAGS as unknown as [string, ...string[]]).optional(),
  published: z.boolean().optional(),
});

// PATCH /api/whatsnew/:id - edit an entry (requires `whatsnew:manage`).
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const actor = await requirePermission("whatsnew:manage");
    if (!actor) return fail("Forbidden", 403);
    const { success } = await rateLimit("admin", clientIp(req));
    if (!success) return fail("Too many requests. Please slow down.", 429);
    if (!isCuid(params.id)) return fail("Invalid id.", 400);

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);

    const entry = await prisma.whatsNewEntry.update({ where: { id: params.id }, data: parsed.data });
    revalidatePath("/");
    await broadcastEvent(CH_NOTIFY, "whatsnew_updated", { id: entry.id });
    return ok({ entry });
  } catch (err) {
    return handleError(err, "whatsnew:update");
  }
}

// DELETE /api/whatsnew/:id - remove an entry (requires `whatsnew:manage`).
export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const actor = await requirePermission("whatsnew:manage");
    if (!actor) return fail("Forbidden", 403);
    const { success } = await rateLimit("admin", clientIp(req));
    if (!success) return fail("Too many requests. Please slow down.", 429);
    if (!isCuid(params.id)) return fail("Invalid id.", 400);

    await prisma.whatsNewEntry.delete({ where: { id: params.id } });
    revalidatePath("/");
    await broadcastEvent(CH_NOTIFY, "whatsnew_updated", { id: params.id });
    return ok({ ok: true });
  } catch (err) {
    return handleError(err, "whatsnew:delete");
  }
}
