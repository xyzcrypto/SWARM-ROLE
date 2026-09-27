/**
 * The reactions a DM message can carry. Client-safe (no server imports): the
 * picker renders this list and the API validates against it.
 *
 * A fixed set on purpose. Free-form emoji would let a reaction carry arbitrary
 * text into someone's private thread, and six is what every messenger worth
 * copying settles on - enough to say something, few enough to pick at a glance.
 */
export const DM_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👍"] as const;
export type DmReaction = (typeof DM_REACTIONS)[number];

export function isDmReaction(v: unknown): v is DmReaction {
  return typeof v === "string" && (DM_REACTIONS as readonly string[]).includes(v);
}

/** What the thread shows under a bubble: my reaction and theirs, each optional. */
export type DmReactions = { mine: DmReaction | null; theirs: DmReaction | null };

/** Map the A/B columns to mine/theirs for the requester. Unknown values drop. */
export function toDmReactions(row: { reactionA: string | null; reactionB: string | null }, iAmA: boolean): DmReactions {
  const mine = iAmA ? row.reactionA : row.reactionB;
  const theirs = iAmA ? row.reactionB : row.reactionA;
  return { mine: isDmReaction(mine) ? mine : null, theirs: isDmReaction(theirs) ? theirs : null };
}
