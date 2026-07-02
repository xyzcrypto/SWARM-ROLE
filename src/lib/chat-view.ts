// Pure, client-safe chat helpers (no server imports) — unit-tested.

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
};

/**
 * Merge a freshly polled window (oldest-first slice of the latest visible
 * messages) into the currently loaded list:
 *  - refresh body/editedAt/reactions on known messages (edits propagate),
 *  - infer deletions: a known, non-pending message that falls inside the
 *    fetched window but is no longer returned was hidden — drop it,
 *  - return genuinely new messages separately (caller appends + notifies).
 */
export function reconcilePoll<T extends PollMessage>(
  prev: T[],
  fresh: T[]
): { merged: T[]; incoming: T[] } {
  const known = new Set(prev.map((m) => m.id));
  const incoming = fresh.filter((m) => !known.has(m.id));
  const byId = new Map(fresh.map((m) => [m.id, m]));

  let merged = prev.map((m) => {
    const f = byId.get(m.id);
    return f ? { ...m, body: f.body, editedAt: f.editedAt ?? m.editedAt ?? null, reactions: f.reactions } : m;
  });

  if (fresh.length) {
    const windowStart = new Date(fresh[0]!.createdAt).getTime();
    merged = merged.filter(
      (m) => m.pending || byId.has(m.id) || new Date(m.createdAt).getTime() < windowStart
    );
  }

  return { merged, incoming };
}
