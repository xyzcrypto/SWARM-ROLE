import { z } from "zod";
import { fail, requirePermission } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { listEntries, setEntryStatus, setOpen, STATUSES } from "@modules/giveaway/lib/entry";
import { academyError, json, PRIVATE } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Staff only (academy:manage; Super Admins hold it implicitly). Full entry
// data incl. emails, so private and never cached.
export async function GET() {
  try {
    const me = await requirePermission("academy:manage");
    if (!me) return fail("Forbidden", 403);
    return json(await listEntries(), PRIVATE);
  } catch (err) {
    return academyError(err, "giveaway:bungee:admin:get");
  }
}

const schema = z.union([
  z.object({ id: z.string().min(1).max(40), status: z.enum(STATUSES), note: z.string().max(500).optional() }),
  z.object({ open: z.boolean() }),
]);

export async function PATCH(req: Request) {
  try {
    const me = await requirePermission("academy:manage");
    if (!me) return fail("Forbidden", 403);
    const { success } = await rateLimit("academyAdmin", me.id);
    if (!success) return fail("Slow down a little.", 429);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Invalid request.", 400);
    if ("open" in parsed.data) {
      await setOpen(parsed.data.open);
      return json({ ok: true, open: parsed.data.open }, PRIVATE);
    }
    return json({ ok: true, entry: await setEntryStatus(parsed.data.id, parsed.data.status, parsed.data.note) }, PRIVATE);
  } catch (err) {
    return academyError(err, "giveaway:bungee:admin:patch");
  }
}
