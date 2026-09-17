import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, requirePermission } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { broadcastEvent, CH_POINTS } from "@/lib/realtime";
import {
  UPDATE_KINDS,
  UPDATE_LIMITS,
  isUpdateKind,
  safeUrl,
  type PointsUpdateDto,
} from "@modules/points/lib/points-updates";

/**
 * Perp DEX / airdrop updates: public read, staff write.
 *
 * ⚠️ `force-dynamic`, NOT an ISR window. Every write broadcasts on CH_POINTS
 * and open pages refetch immediately, so a cached response would be handing
 * readers a stale feed seconds after the point of the feature is that it is
 * not stale. The edge header is short for the same reason.
 *
 * ⚠️ NOT POLLED by the client - it fetches on mount and on a broadcast - so
 * this is deliberately absent from `TARGETS` in
 * markets-poll-alignment.test.ts. If an interval is ever added, add it there.
 */
export const dynamic = "force-dynamic";

/** Table missing (never migrated) - not an error worth 503-ing a page over. */
const isMissingTable = (err: unknown) => {
  const code = (err as { code?: string })?.code;
  return code === "P2021" || code === "P2022";
};

function toDto(r: {
  id: string;
  title: string;
  body: string;
  kind: string;
  program: string | null;
  url: string | null;
  image?: string | null;
  pinned: boolean;
  published: boolean;
  createdAt: Date;
}): PointsUpdateDto {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    // A row written before a kind was removed from the union must not break the
    // feed; it degrades to the neutral kind instead.
    kind: isUpdateKind(r.kind) ? r.kind : "update",
    program: r.program,
    url: safeUrl(r.url),
    // ⚠️ Through `safeUrl` like every other URL here. An image src is a URL the
    // browser fetches, so it goes through the same http(s)-only gate rather
    // than being trusted because it came from an upload - the column can also
    // be written by a future path that does not.
    image: safeUrl(r.image ?? null),
    pinned: r.pinned,
    published: r.published,
    createdAt: r.createdAt.toISOString(),
  };
}

// GET /api/points/updates?all=1 - the feed. `all` includes unpublished drafts
// and requires the manage permission.
export async function GET(req: Request) {
  const wantsDrafts = new URL(req.url).searchParams.get("all") === "1";
  try {
    let includeDrafts = false;
    if (wantsDrafts) {
      includeDrafts = Boolean(await requirePermission("points:manage"));
      // Asking for drafts without the permission returns the PUBLIC feed rather
      // than 403: the admin UI and the public page share this route, and a
      // signed-out tab left open should degrade, not error.
    }
    const rows = await prisma.pointsUpdate.findMany({
      where: includeDrafts ? {} : { published: true },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: UPDATE_LIMITS.take,
    });
    return new Response(JSON.stringify({ updates: rows.map(toDto), live: true }), {
      headers: {
        "Content-Type": "application/json",
        // Short, and private when drafts are in the payload - a draft must
        // never be cached at the edge where a reader could be served it.
        "Cache-Control": includeDrafts
          ? "private, no-store"
          : "public, s-maxage=30, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    // No table yet: an empty feed is the truth, and it lets /points ship before
    // the migration lands rather than after it.
    if (isMissingTable(err)) return ok({ updates: [], live: false });
    return handleError(err, "points:updates:get");
  }
}

const createSchema = z.object({
  title: z.string().trim().min(3, "Title is too short.").max(UPDATE_LIMITS.title),
  body: z.string().trim().min(3, "Body is too short.").max(UPDATE_LIMITS.body),
  kind: z.enum(UPDATE_KINDS as unknown as [string, ...string[]]),
  program: z.string().trim().max(60).optional().nullable(),
  url: z.string().trim().max(500).optional().nullable(),
  image: z.string().trim().max(500).optional().nullable(),
  pinned: z.boolean().optional(),
  published: z.boolean().optional(),
});

// POST /api/points/updates - create (requires `points:manage`).
export async function POST(req: Request) {
  try {
    const actor = await requirePermission("points:manage");
    if (!actor) return fail("Forbidden", 403);
    const { success } = await rateLimit("admin", clientIp(req));
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);

    // ⚠️ Normalised BEFORE storing, not on the way out. A `javascript:` URL
    // that only gets filtered at render time is one careless consumer away
    // from being rendered - keeping it out of the row is the durable fix.
    const url = safeUrl(parsed.data.url ?? null);
    if (parsed.data.url?.trim() && !url) return fail("Link must be a http(s) URL.", 400);

    const row = await prisma.pointsUpdate.create({
      data: {
        title: parsed.data.title,
        body: parsed.data.body,
        kind: parsed.data.kind,
        program: parsed.data.program?.trim() || null,
        url,
        pinned: parsed.data.pinned ?? false,
        published: parsed.data.published ?? true,
      },
    });

    // Only a PUBLISHED update is news to anyone. Broadcasting a draft would
    // make every open page refetch and find nothing new.
    if (row.published) await broadcastEvent(CH_POINTS, "points_update", { id: row.id });
    return ok({ update: toDto(row) });
  } catch (err) {
    if (isMissingTable(err)) return fail("Updates table is not migrated yet.", 503);
    return handleError(err, "points:updates:create");
  }
}
