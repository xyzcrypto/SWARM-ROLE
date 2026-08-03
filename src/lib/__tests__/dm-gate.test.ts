import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * The gate decides who may message whom, so its rules are worth pinning
 * independently of a database. Prisma is faked here; what is under test is the
 * policy, not the query.
 */
const db = {
  block: { findFirst: vi.fn(), findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  follow: { findUnique: vi.fn() },
};
vi.mock("@core/db/prisma", () => ({ prisma: db }));

const load = async () => await import("@/lib/dm-gate");

describe("dm-gate", () => {
  beforeEach(() => {
    vi.resetModules();
    db.block.findFirst.mockReset().mockResolvedValue(null);
    db.user.findUnique.mockReset().mockResolvedValue({ dmPrivacy: "everyone" });
    db.follow.findUnique.mockReset().mockResolvedValue(null);
  });

  it("lets an ordinary pair message", async () => {
    const { canStartConversation, canSendInThread } = await load();
    expect((await canStartConversation("a", "b")).ok).toBe(true);
    expect((await canSendInThread("a", "b")).ok).toBe(true);
  });

  /**
   * The rule most easily got wrong. A block row is one-way, but at send time it
   * has to bite in both directions: enforcing it only against the blocked party
   * would leave the blocker still receiving, which is the thing they asked to
   * stop.
   */
  it("stops BOTH directions once either side has blocked", async () => {
    db.block.findFirst.mockResolvedValue({ id: "blk" });
    const { canSendInThread, canStartConversation, isBlockedEitherWay } = await load();
    expect(await isBlockedEitherWay("a", "b")).toBe(true);
    expect((await canSendInThread("a", "b")).ok).toBe(false);
    expect((await canSendInThread("b", "a")).ok).toBe(false);
    expect((await canStartConversation("a", "b")).ok).toBe(false);
  });

  it("refuses a new conversation when the recipient allows nobody", async () => {
    db.user.findUnique.mockResolvedValue({ dmPrivacy: "nobody" });
    const { canStartConversation } = await load();
    expect((await canStartConversation("a", "b")).ok).toBe(false);
  });

  /**
   * Tightening a setting must not sever threads already open. That is what
   * blocking is for; a privacy setting is about who may approach you.
   */
  it("does NOT freeze an existing thread when privacy is set to nobody", async () => {
    db.user.findUnique.mockResolvedValue({ dmPrivacy: "nobody" });
    const { canSendInThread } = await load();
    expect((await canSendInThread("a", "b")).ok).toBe(true);
  });

  describe('"only people I follow"', () => {
    it("allows someone the RECIPIENT follows", async () => {
      db.user.findUnique.mockResolvedValue({ dmPrivacy: "following" });
      db.follow.findUnique.mockResolvedValue({ id: "f" });
      const { canStartConversation } = await load();
      expect((await canStartConversation("sender", "recipient")).ok).toBe(true);
    });

    it("refuses someone the recipient does not follow", async () => {
      db.user.findUnique.mockResolvedValue({ dmPrivacy: "following" });
      db.follow.findUnique.mockResolvedValue(null);
      const { canStartConversation } = await load();
      expect((await canStartConversation("sender", "recipient")).ok).toBe(false);
    });

    it("checks the RECIPIENT's follows, not the sender's", async () => {
      // Using the follower list instead would let anyone who follows them
      // through - the opposite of a filter.
      db.user.findUnique.mockResolvedValue({ dmPrivacy: "following" });
      db.follow.findUnique.mockResolvedValue({ id: "f" });
      const { canStartConversation } = await load();
      await canStartConversation("sender", "recipient");
      expect(db.follow.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { followerId_followingId: { followerId: "recipient", followingId: "sender" } },
        })
      );
    });
  });

  it("gives the same message whether blocked or filtered", async () => {
    // Telling someone they were specifically blocked hands a harasser a
    // confirmation signal, and the recipient gains nothing from the distinction.
    db.block.findFirst.mockResolvedValue({ id: "blk" });
    const { canStartConversation } = await load();
    const blockedReason = await canStartConversation("a", "b");

    db.block.findFirst.mockResolvedValue(null);
    db.user.findUnique.mockResolvedValue({ dmPrivacy: "nobody" });
    const { canStartConversation: again } = await load();
    const filteredReason = await again("a", "b");

    expect(blockedReason.ok).toBe(false);
    expect(filteredReason.ok).toBe(false);
    if (!blockedReason.ok && !filteredReason.ok) {
      expect(blockedReason.reason).toBe(filteredReason.reason);
    }
  });

  it("falls open rather than breaking DMs on a database without the table", async () => {
    db.block.findFirst.mockRejectedValue(new Error("relation Block does not exist"));
    const { isBlockedEitherWay } = await load();
    expect(await isBlockedEitherWay("a", "b")).toBe(false);
  });

  it("recognises only the three known privacy values", async () => {
    const { isDmPrivacy } = await load();
    expect(isDmPrivacy("everyone")).toBe(true);
    expect(isDmPrivacy("following")).toBe(true);
    expect(isDmPrivacy("nobody")).toBe(true);
    expect(isDmPrivacy("friends")).toBe(false);
    expect(isDmPrivacy(null)).toBe(false);
  });
});
