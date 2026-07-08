// Direct-message helpers. Pure functions live here so they can be unit-tested
// without a DB. A conversation is the canonical pair of two user ids, always
// stored with the smaller id as userAId so the pair is unique regardless of who
// starts the chat.

export const DM_MAX_LEN = 2000; // per-message character cap

/** Canonical ordering of a user pair. `iAmA` tells the caller which side they are. */
export function orderPair(id1: string, id2: string): { userAId: string; userBId: string } {
  return id1 < id2 ? { userAId: id1, userBId: id2 } : { userAId: id2, userBId: id1 };
}

/** A short single-line preview of a message body for the inbox list. */
export function snippet(body: string, max = 140): string {
  const oneLine = body.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? oneLine.slice(0, max - 1).trimEnd() + "…" : oneLine;
}

// The columns needed to describe the "other" participant in a conversation.
export const DM_USER_SELECT = { id: true, name: true, username: true, image: true } as const;

type ConvSides = {
  userAId: string;
  userBId: string;
  userA?: { id: string; name: string | null; username: string | null; image: string | null } | null;
  userB?: { id: string; name: string | null; username: string | null; image: string | null } | null;
  readAAt?: Date | null;
  readBAt?: Date | null;
};

/** Given a loaded conversation and my id, return the other participant + my read timestamp. */
export function otherOf(conv: ConvSides, myId: string) {
  const iAmA = conv.userAId === myId;
  return {
    iAmA,
    other: iAmA ? conv.userB ?? null : conv.userA ?? null,
    myReadAt: iAmA ? conv.readAAt ?? null : conv.readBAt ?? null,
  };
}

/** Whether a conversation is unread for me: last message is newer than my read
 * mark and it wasn't sent by me. */
export function isUnread(
  conv: { lastMessageAt: Date; lastSenderId: string | null; readAAt?: Date | null; readBAt?: Date | null; userAId: string },
  myId: string
): boolean {
  if (!conv.lastSenderId || conv.lastSenderId === myId) return false;
  const myReadAt = conv.userAId === myId ? conv.readAAt : conv.readBAt;
  return !myReadAt || conv.lastMessageAt.getTime() > myReadAt.getTime();
}
