import { prisma } from "@core/db/prisma";

/**
 * May these two people message each other?
 *
 * One place, called by both DM write paths - starting a conversation and
 * sending into one. Two gates that are easy to get subtly wrong apart:
 *
 * **Blocks are symmetric at send time even though the row is one-way.** If
 * either side has blocked the other, neither can send. Enforcing it only
 * against the blocked party would leave the blocker still receiving, which is
 * exactly the thing they asked to stop.
 *
 * **Privacy is the recipient's setting, and only gates NEW conversations.**
 * Someone who tightens their setting to "nobody" has not asked to have their
 * existing threads cut off mid-sentence; they have asked not to be approached
 * by strangers. Blocking is the tool for ending a conversation already open.
 *
 * The failure messages are deliberately identical for "they blocked you" and
 * "their settings don't allow it". Telling someone they have specifically been
 * blocked hands a harasser a confirmation signal, and the recipient gains
 * nothing from them knowing which of the two it was.
 */
export type DmGate = { ok: true } | { ok: false; reason: string };

const CANNOT_MESSAGE = "You can't message this member.";

/** Is there a block in either direction between these two? */
export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  const row = await prisma.block
    .findFirst({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
      select: { id: true },
    })
    .catch(() => null); // not-yet-migrated: fall open rather than break DMs
  return !!row;
}

/**
 * Gate for sending into an EXISTING conversation. Blocks only - the recipient's
 * privacy setting is about who may start one, not about freezing a thread that
 * is already underway.
 */
export async function canSendInThread(meId: string, otherId: string): Promise<DmGate> {
  return (await isBlockedEitherWay(meId, otherId)) ? { ok: false, reason: CANNOT_MESSAGE } : { ok: true };
}

/**
 * Gate for STARTING a conversation: blocks, plus the recipient's own rule about
 * who may approach them.
 *
 * "following" means the people the RECIPIENT follows. That is the inbox they
 * opted into; using their follower list instead would let anyone who follows
 * them through, which is the opposite of a filter.
 */
export async function canStartConversation(meId: string, targetId: string): Promise<DmGate> {
  if (await isBlockedEitherWay(meId, targetId)) return { ok: false, reason: CANNOT_MESSAGE };

  const target = await prisma.user
    .findUnique({ where: { id: targetId }, select: { dmPrivacy: true } })
    .catch(() => null);
  const setting = target?.dmPrivacy ?? "everyone";

  if (setting === "nobody") return { ok: false, reason: CANNOT_MESSAGE };
  if (setting === "following") {
    const follows = await prisma.follow
      .findUnique({ where: { followerId_followingId: { followerId: targetId, followingId: meId } }, select: { id: true } })
      .catch(() => null);
    if (!follows) return { ok: false, reason: CANNOT_MESSAGE };
  }
  return { ok: true };
}

export const DM_PRIVACY_OPTIONS = ["everyone", "following", "nobody"] as const;
export type DmPrivacy = (typeof DM_PRIVACY_OPTIONS)[number];

export function isDmPrivacy(v: unknown): v is DmPrivacy {
  return typeof v === "string" && (DM_PRIVACY_OPTIONS as readonly string[]).includes(v);
}
