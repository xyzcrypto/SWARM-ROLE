import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, requirePermission, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { maskEmail } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/**
 * GET /api/reports?status=open - the moderation queue: DM reports AND
 * community-chat reports, newest first, each tagged with `kind`.
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

    // Community-chat reports. `ChatReport` rows were written by
    // /api/chat/messages/[id]/report and read by NOTHING, so a member's report
    // never reached anyone (review L5). They join this queue: same permission,
    // same people, one place to look. Chat is a public room, so showing the
    // message costs no privacy. "dismissed" (a ChatReport-only state) reads as
    // reviewed here.
    const chatRows = await prisma.chatReport
      .findMany({
        where: status === "open" ? { status: "open" } : { status: { in: ["reviewed", "dismissed"] } },
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE,
        select: {
          id: true,
          createdAt: true,
          reason: true,
          details: true,
          status: true,
          user: { select: { id: true, name: true, username: true, email: true } },
          message: {
            select: {
              id: true,
              body: true,
              status: true,
              hiddenBy: true,
              createdAt: true,
              user: { select: { id: true, name: true, username: true, email: true } },
            },
          },
        },
      })
      .catch(() => [] as never[]);

    const person = (u: { id: string; name: string | null; username: string | null; email: string }) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      email: maskEmail(u.email),
    });

    const chat = chatRows.map((r) => ({
      kind: "chat" as const,
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      reason: r.reason,
      note: r.details || null,
      status: r.status === "open" ? "open" : "reviewed",
      reporter: person(r.user),
      subject: person(r.message.user),
      message: {
        id: r.message.id,
        body: r.message.body,
        deleted: r.message.status === "hidden" && r.message.hiddenBy === "author",
        hidden: r.message.status === "hidden",
        createdAt: r.message.createdAt.toISOString(),
      },
    }));

    const dm = rows.map((r) => {
        const cited = r.messageId ? byId.get(r.messageId) : null;
        return {
          kind: "dm" as const,
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
            ? { id: null, body: cited.body, deleted: cited.status === "deleted", hidden: false, createdAt: cited.createdAt.toISOString() }
            : null,
        };
      });

    // One queue, newest first, one page.
    const reports = [...dm, ...chat].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, PAGE_SIZE);
    return ok({ reports });
  } catch (err) {
    return handleError(err, "reports:list");
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["open", "reviewed"]),
  // Which table: a DM report (`Report`) or a community-chat one (`ChatReport`).
  kind: z.enum(["dm", "chat"]).default("dm"),
});

// PATCH /api/reports - mark a report reviewed (or put it back in the queue).
// Deliberately reversible: "reviewed" is a triage state, not a deletion, and
// reopening should not require a database console.
export async function PATCH(req: Request) {
  try {
    const actor = await requirePermission("post:manage");
    if (!actor) return fail("Unauthorized", 401);

    // Staff-gated, but still throttled - the repo's api-rate-limits guard test
    // asks every mutating handler for this, and it is right to: a compromised
    // or careless staff session should not be able to rewrite the whole queue
    // as fast as it can post. Same `admin` bucket the other staff writes use.
    const { success } = await rateLimit("admin", `reports:${actor.id}`);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Invalid request.", 400);
    if (!isCuid(parsed.data.id)) return fail("Invalid report.", 400);

    const { id, status, kind } = parsed.data;
    if (kind === "chat") await prisma.chatReport.update({ where: { id }, data: { status } });
    else await prisma.report.update({ where: { id }, data: { status } });
    return ok({ id, status, kind });
  } catch (err) {
    return handleError(err, "reports:patch");
  }
}
