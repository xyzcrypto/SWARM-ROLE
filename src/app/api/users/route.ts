import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, requirePermission } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const EXPORT_CAP = 10_000;

import { publicImageUrl } from "@/lib/utils";
import { todayKey } from "@/lib/xp";
import { memberCheckins } from "@/lib/member-checkins";

const SELECT = {
  id: true,
  name: true,
  // The handle is what makes a row clickable through to the public profile -
  // an admin looking at a member should not have to go and find them by hand.
  username: true,
  image: true,
  email: true,
  provider: true,
  role: true,
  membership: true,
  createdAt: true,
  lastLoginAt: true,
} as const;

function whereFor(q: string): Prisma.UserWhereInput {
  return q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

// GET /api/users - paginated, server-side-searchable member list for the
// dashboard Members panel (`users:manage`). `?q=` searches ALL members by
// email/name (not just the most recent page); `?cursor=<id>` pages onward;
// `?format=csv` streams a complete export instead of the 50-row page.
export async function GET(req: Request) {
  try {
    const actor = await requirePermission("users:manage");
    if (!actor) return fail("Forbidden", 403);

    const { success } = await rateLimit("admin", `users:${actor.id}`);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const params = new URL(req.url).searchParams;
    const q = (params.get("q") || "").trim().slice(0, 120);
    const where = whereFor(q);

    if (params.get("format") === "csv") {
      const rows = await prisma.user.findMany({
        where,
        take: EXPORT_CAP,
        orderBy: { createdAt: "desc" },
        select: SELECT,
      });
      // The export is how "who checked in, and for how long?" gets answered
      // for everyone at once rather than a screen at a time, so the handle and
      // the check-in figures belong here too.
      const csvCheckins = await memberCheckins(rows.map((u) => u.id), todayKey());
      const header = "Name,Username,Email,Membership,Role,Method,Signup Date,Last Login,Check-in Streak,Check-in Days";
      const body = rows
        .map((u) =>
          [
            u.name ?? "",
            u.username ?? "",
            u.email,
            u.membership,
            u.role,
            u.provider,
            u.createdAt.toISOString(),
            u.lastLoginAt ? u.lastLoginAt.toISOString() : "Never",
            String(csvCheckins.get(u.id)?.streak ?? 0),
            String(csvCheckins.get(u.id)?.total ?? 0),
          ]
            .map(csvCell)
            .join(",")
        )
        .join("\n");
      return new Response(`${header}\n${body}\n`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="xyz-crypto-members.csv"',
          "Cache-Control": "no-store",
        },
      });
    }

    const cursor = params.get("cursor");
    const rows = await prisma.user.findMany({
      where,
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      select: SELECT,
    });
    const hasMore = rows.length > PAGE_SIZE;
    const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

    // Two queries for the whole page, not one per row.
    const checkins = await memberCheckins(page.map((u) => u.id), todayKey());

    return ok({
      users: page.map((u) => ({
        ...u,
        // An inline data: avatar goes out as a /api/media URL, never as a
        // base64 blob multiplied by the page size.
        image: publicImageUrl(u.image, u.id),
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        checkinStreak: checkins.get(u.id)?.streak ?? 0,
        checkinTotal: checkins.get(u.id)?.total ?? 0,
      })),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    });
  } catch (err) {
    return handleError(err, "users:list");
  }
}
