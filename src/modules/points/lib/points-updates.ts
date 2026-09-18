/**
 * The vocabulary of a perp DEX / airdrop update.
 *
 * Kinds exist rather than free-text tags because the feed's whole job is
 * answering one question fast - "can I still farm this, and do I need to do
 * something today?" - and free text cannot be sorted, filtered or coloured.
 *
 * Deliberately small. Every kind here is a distinct ACTION for the reader; if
 * two kinds would produce the same action, they should be one kind.
 */
export const UPDATE_KINDS = ["live", "soon", "snapshot", "tge", "ended", "alert", "update"] as const;

export type UpdateKind = (typeof UPDATE_KINDS)[number];

export function isUpdateKind(v: unknown): v is UpdateKind {
  return typeof v === "string" && (UPDATE_KINDS as readonly string[]).includes(v);
}

export const KIND_LABEL: Record<UpdateKind, string> = {
  live: "Points live",
  soon: "Coming soon",
  snapshot: "Snapshot",
  tge: "TGE",
  ended: "Ended",
  alert: "Heads up",
  update: "Update",
};

/**
 * Tone per kind.
 *
 * ⚠️ Semantic tokens and brand ramps only - no `text-mint-100`-style
 * dark-only foregrounds on a tinted ground. That exact mistake made the whole
 * points UI score 1.01:1 in the light theme, and these badges sit on the same
 * kind of tint. See points-light-theme.test.ts.
 */
export const KIND_TONE: Record<UpdateKind, string> = {
  live: "border-mint-500/30 bg-mint-500/10 text-mint-200",
  soon: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  snapshot: "border-gold-500/30 bg-gold-500/10 text-gold-200",
  tge: "border-gold-500/40 bg-gold-500/15 text-gold-200",
  ended: "border-hairline bg-white/[0.03] text-content-subtle",
  alert: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  update: "border-hairline bg-white/[0.03] text-content-muted",
};

/** What the public feed and the admin editor both agree an update looks like. */
export type PointsUpdateDto = {
  id: string;
  title: string;
  body: string;
  kind: UpdateKind;
  program: string | null;
  url: string | null;
  /** Cover image URL, or null. Uploaded via /api/upload. */
  image: string | null;
  pinned: boolean;
  published: boolean;
  createdAt: string; // ISO - serialised on the server, never a Date over the wire
};

export const UPDATE_LIMITS = {
  title: 120,
  body: 2000,
  /** One page of the feed. Deliberately small: this is a "what changed" list,
   *  not an archive, and an unbounded query is how a cheap route becomes an
   *  expensive one. */
  take: 30,
} as const;

/**
 * Sort exactly as the index is built: pinned first, then newest.
 *
 * Kept here rather than only in the route so the client can re-sort after a
 * realtime insert without refetching - and so both orderings are the same
 * function rather than two that drift.
 */
export function sortUpdates(list: PointsUpdateDto[]): PointsUpdateDto[] {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/**
 * Only http(s), and only as a plain absolute URL.
 *
 * An update's `url` is rendered as a link a reader will click, so anything that
 * can carry script - `javascript:`, `data:` - must never survive. Rejecting
 * rather than sanitising: a URL we cannot parse is a URL we should not publish.
 */
export function safeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}
