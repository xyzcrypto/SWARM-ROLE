import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, requirePermission, isCuid } from "@/lib/api";
import { maskEmail } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/**
 * GET /api/reports?status=open - the moderation queue.
 *
 * Gated on `post:manage`, the same permission the comment and chat moderation
 * screens use. Reports are about member behaviour, so they belong to whoever
 * already handles moderation rather than needing a permission of their own.
 *
 * ## The privacy call, stated plainly
 *
 * When a report cites a DM, the reported message's text is returned here - so a
 * private message becomes readable by staff. That is the whole point of citing
 * it: a report nobody can evaluate is a report nobody can act on, and the
 * reporter chose to hand it over.
 *
 * The line is drawn at exactly that message. The rest of the conversation is
 * not fetched, and email addresses are masked the same way the members table
 * masks them. If this ever needs to widen, it should be a deliberate decision
 * with the owner, not a quiet `include`.
 */
export async function GET(req: Request) {
  try {
    const actor = await requirePermission("post:manage");
    if (!actor) return fail("Unauthorized", 401);

    const status = new URL(req.url).searchParams.get("status") === "reviewed" ? "reviewed" : "open";

    const rows = await prisma.report
      .findMany({
        where: { status },
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE,
        select: {
          id: true,
          createdAt: true,
          reason: true,
          note: true,
          status: true,
          messageId: true,
          reporter: { select: { id: true, name: true, username: true, email: true } },
          subject: { select: { id: true, name: true, username: true, email: true } },
        },
      })
      .catch(() => [] as never[]); // pre-migration: an empty queue, not a 500

    // The cited message, in one query for the page rather than one per row.
    const ids = rows.map((r) => r.messageId).filter((v): v is string => !!v);
    const messages = ids.length
      ? await prisma.directMessage
          .findMany({ where: { id: { in: ids } }, select: { id: true, body: true, status: true, createdAt: true } })
          .catch(() => [] as { id: string; body: string; status: string; createdAt: Date }[])
      : [];
    const byId = new Map(messages.map((m) => [m.id, m]));

    return ok({
      reports: rows.map((r) => {
        const cited = r.messageId ? byId.get(r.messageId) : null;
        return {
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          reason: r.reason,
          note: r.note,
          status: r.status,
          reporter: {
            id: r.reporter.id,
            name: r.reporter.name,
            username: r.reporter.username,
            email: maskEmail(r.reporter.email),
          },
          subject: {
            id: r.subject.id,
            name: r.subject.name,
            username: r.subject.username,
            email: maskEmail(r.subject.email),
          },
          // A message the sender has since deleted still matters to a report -
          // that is exactly why DM deletes are soft - so it is reported as
          // deleted rather than omitted.
          message: cited
            ? { body: cited.body, deleted: cited.status === "deleted", createdAt: cited.createdAt.toISOString() }
            : null,
        };
      }),
    });
  } catch (err) {
    return handleError(err, "reports:list");
  }
}

const patchSchema = z.object({ id: z.string().min(1), status: z.enum(["open", "reviewed"]) });

// PATCH /api/reports - mark a report reviewed (or put it back in the queue).
// Deliberately reversible: "reviewed" is a triage state, not a deletion, and
// reopening should not require a database console.
export async function PATCH(req: Request) {
  try {
    const actor = await requirePermission("post:manage");
    if (!actor) return fail("Unauthorized", 401);

    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Invalid request.", 400);
    if (!isCuid(parsed.data.id)) return fail("Invalid report.", 400);

    await prisma.report.update({ where: { id: parsed.data.id }, data: { status: parsed.data.status } });
    return ok({ id: parsed.data.id, status: parsed.data.status });
  } catch (err) {
    return handleError(err, "reports:patch");
  }
}
