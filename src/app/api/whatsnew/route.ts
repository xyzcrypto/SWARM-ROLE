import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, requirePermission } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { broadcastEvent, CH_NOTIFY } from "@/lib/realtime";
import { WHATS_NEW, WHATS_NEW_TAGS, isWhatsNewTag, type WhatsNewEntry } from "@/lib/whatsnew";

export const dynamic = "force-dynamic";

// Static fallback (and search over it) for when the DB has no rows yet or the
// table isn't migrated - keeps the homepage feed populated from day one.
function staticFallback(tag?: string | null, q?: string | null): WhatsNewEntry[] {
  let list = WHATS_NEW.map((e, i) => ({ id: `static-${i}`, ...e }));
  if (tag && isWhatsNewTag(tag)) list = list.filter((e) => e.tag === tag);
  if (q) {
    const s = q.toLowerCase();
    list = list.filter((e) => `${e.title} ${e.body}`.toLowerCase().includes(s));
  }
  return list;
}

// GET /api/whatsnew?tag=&q=&limit= - public, filterable/searchable, cached.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tag = searchParams.get("tag");
  const q = searchParams.get("q");
  const take = Math.min(Math.max(Number(searchParams.get("limit")) || 24, 1), 50);
  try {
    const where: Record<string, unknown> = { published: true };
    if (tag && isWhatsNewTag(tag)) where.tag = tag;
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { body: { contains: q, mode: "insensitive" } },
      ];
    }
    const rows = await prisma.whatsNewEntry.findMany({ where, orderBy: { date: "desc" }, take });
    const entries: WhatsNewEntry[] =
      rows.length === 0 && !tag && !q
        ? staticFallback()
        : rows.map((r) => ({ id: r.id, date: r.date.toISOString(), tag: r.tag as WhatsNewEntry["tag"], title: r.title, body: r.body }));
    return new Response(JSON.stringify({ entries }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err: unknown) {
    // Table not migrated yet → serve the static fallback rather than 503.
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") return ok({ entries: staticFallback(tag, q) });
    return handleError(err, "whatsnew:get");
  }
}

const createSchema = z.object({
  title: z.string().trim().min(3, "Title is too short.").max(120),
  body: z.string().trim().min(3, "Body is too short.").max(1000),
  tag: z.enum(WHATS_NEW_TAGS as unknown as [string, ...string[]]),
  published: z.boolean().optional(),
});

// POST /api/whatsnew - create an entry (requires `whatsnew:manage`).
export async function POST(req: Request) {
  try {
    const actor = await requirePermission("whatsnew:manage");
    if (!actor) return fail("Forbidden", 403);
    const { success } = await rateLimit("admin", clientIp(req));
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);

    const entry = await prisma.whatsNewEntry.create({ data: { ...parsed.data } });
    revalidatePath("/");
    await broadcastEvent(CH_NOTIFY, "whatsnew_updated", { id: entry.id });
    return ok({ entry });
  } catch (err) {
    return handleError(err, "whatsnew:create");
  }
}
