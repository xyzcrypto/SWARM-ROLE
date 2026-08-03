// Pure, client-safe chat helpers (no server imports) - unit-tested.

/** Authors may edit their own message for this long after sending. */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

export function canEditMessage(createdAt: string | Date, now: number = Date.now()): boolean {
  return now - new Date(createdAt).getTime() <= EDIT_WINDOW_MS;
}

type PollMessage = {
  id: string;
  body: string;
  createdAt: string;
  editedAt?: string | null;
  pending?: boolean;
  hidden?: boolean;
  reactions: unknown;
  poll?: unknown;
};

export type PollCounts = { optionId: string; count: number }[];

/**
 * Optimistically apply a local vote change to option counts.
 * `from` = previously selected optionId (null if none); `to` = newly selected
 * (null = retract). Returns new counts (never below zero).
 */
export function applyPollVote(counts: PollCounts, from: string | null, to: string | null): PollCounts {
  return counts.map((c) => {
    let n = c.count;
    if (from && c.optionId === from) n -= 1;
    if (to && c.optionId === to) n += 1;
    return { optionId: c.optionId, count: Math.max(0, n) };
  });
}

/** Percentage share per option (integers, safe for zero totals). */
export function pollShares(counts: PollCounts): Map<string, number> {
  const total = counts.reduce((s, c) => s + c.count, 0);
  return new Map(counts.map((c) => [c.optionId, total === 0 ? 0 : Math.round((c.count / total) * 100)]));
}

const ts = (m: PollMessage) => new Date(m.createdAt).getTime();

/**
 * Merge a freshly polled window (oldest-first slice of the latest visible
 * messages) into the currently loaded list:
 *  - refresh body/editedAt/reactions on known messages (edits propagate),
 *  - infer deletions: a known, non-pending message that falls inside the
 *    fetched window but is no longer returned was hidden - drop it,
 *  - splice in any history the window reached further back than we held,
 *  - return genuinely new messages separately (caller appends + notifies).
 *
 * ## The bug this last part fixes
 *
 * "Unknown id" used to mean "new message", and the caller appends those to the
 * end of the list. But the poll window is NOT the same size as the initial
 * render: `/community` server-renders the newest 30 messages, and
 * `/api/chat/messages` returns the newest 50. So the very first poll, ten
 * seconds after opening the room, hands back 20 messages that are unknown and
 * **older than everything on screen** - and they were appended underneath the
 * newest one. The room auto-scrolls to the bottom, so the reader was dropped
 * into four-day-old history a few seconds after opening a room that had just
 * shown them the latest messages. Reproduced exactly:
 *
 *     t= 0s  msgs=30  last=new-3    (today - correct)
 *     t=10s  msgs=43  last=old-13   (Jul 30 - the first poll)
 *
 * They also counted as unread and rang the incoming-message sound.
 *
 * So arrivals are now split by time, not by novelty: anything at or before the
 * newest message already held is backfill and gets sorted into place; only
 * genuinely newer messages are returned as `incoming`.
 */
export function reconcilePoll<T extends PollMessage>(
  prev: T[],
  fresh: T[]
): { merged: T[]; incoming: T[] } {
  const known = new Set(prev.map((m) => m.id));
  const byId = new Map(fresh.map((m) => [m.id, m]));

  let merged = prev.map((m) => {
    const f = byId.get(m.id);
    return f
      ? { ...m, body: f.body, editedAt: f.editedAt ?? m.editedAt ?? null, reactions: f.reactions, poll: f.poll ?? m.poll }
      : m;
  });

  if (fresh.length) {
    const windowStart = ts(fresh[0]!);
    merged = merged.filter((m) => m.pending || byId.has(m.id) || ts(m) < windowStart);
  }

  const arrivals = fresh.filter((m) => !known.has(m.id));

  // The newest settled message we hold. Pending (optimistic) sends are excluded
  // deliberately: they are stamped with the local clock, and letting one mask
  // the high-water mark would make a real new message look like backfill.
  const newestHeld = merged.reduce((max, m) => (m.pending ? max : Math.max(max, ts(m))), -Infinity);

  const incoming = arrivals.filter((m) => ts(m) > newestHeld);
  const backfill = arrivals.filter((m) => ts(m) <= newestHeld);

  if (backfill.length) {
    // Sort history into position instead of appending it. Pending sends stay at
    // the end, where the composer just put them.
    const pending = merged.filter((m) => m.pending);
    const settled = merged.filter((m) => !m.pending);
    merged = [
      ...[...settled, ...backfill].sort((a, b) => ts(a) - ts(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
      ...pending,
    ];
  }

  return { merged, incoming };
}
