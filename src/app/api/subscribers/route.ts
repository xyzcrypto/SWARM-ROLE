import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, requirePermission } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { csvCell } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const EXPORT_CAP = 10_000;

// Shared csvCell: quotes every cell and neutralises formulas (CSV injection).

// GET /api/subscribers - the newsletter/waitlist list finally gets a reader
// (users:manage): cursor-paginated JSON, or ?format=csv for a full export.
export async function GET(req: Request) {
  try {
    const actor = await requirePermission("users:manage");
    if (!actor) return fail("Forbidden", 403);

    const { success } = await rateLimit("admin", `subscribers:${actor.id}`);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const params = new URL(req.url).searchParams;

    if (params.get("format") === "csv") {
      const rows = await prisma.subscriber.findMany({
        take: EXPORT_CAP,
        orderBy: { createdAt: "desc" },
      });
      const header = "Email,Source,Subscribed";
      const body = rows
        .map((s) => [s.email, s.source, s.createdAt.toISOString()].map(csvCell).join(","))
        .join("\n");
      return new Response(`${header}\n${body}\n`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="xyz-crypto-subscribers.csv"',
          "Cache-Control": "no-store",
        },
      });
    }

    const cursor = params.get("cursor");
    const [rows, total] = await Promise.all([
      prisma.subscriber.findMany({
        take: PAGE_SIZE + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: "desc" },
      }),
      prisma.subscriber.count(),
    ]);
    const hasMore = rows.length > PAGE_SIZE;
    const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

    return ok({
      total,
      subscribers: page.map((s) => ({
        id: s.id,
        email: s.email,
        source: s.source,
        createdAt: s.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    });
  } catch (err) {
    return handleError(err, "subscribers:list");
  }
}
