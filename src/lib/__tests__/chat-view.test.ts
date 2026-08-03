import { describe, expect, it } from "vitest";
import { EDIT_WINDOW_MS, applyPollVote, canEditMessage, pollShares, reconcilePoll } from "@/lib/chat-view";

const NOW = 1_800_000_000_000;
const iso = (t: number) => new Date(t).toISOString();

describe("canEditMessage", () => {
  it("allows editing inside the window", () => {
    expect(canEditMessage(iso(NOW - 60_000), NOW)).toBe(true);
    expect(canEditMessage(iso(NOW - EDIT_WINDOW_MS), NOW)).toBe(true);
  });
  it("rejects editing after the window", () => {
    expect(canEditMessage(iso(NOW - EDIT_WINDOW_MS - 1), NOW)).toBe(false);
    expect(canEditMessage(iso(NOW - 60 * 60_000), NOW)).toBe(false);
  });
  it("accepts Date objects", () => {
    expect(canEditMessage(new Date(NOW - 1000), NOW)).toBe(true);
  });
});

type M = {
  id: string;
  body: string;
  createdAt: string;
  editedAt?: string | null;
  pending?: boolean;
  hidden?: boolean;
  reactions: unknown;
};
const msg = (id: string, at: number, extra: Partial<M> = {}): M => ({
  id,
  body: `body-${id}`,
  createdAt: iso(at),
  reactions: [],
  ...extra,
});

describe("reconcilePoll", () => {
  it("returns new messages as incoming without duplicating known ones", () => {
    const prev = [msg("a", NOW - 3000)];
    const fresh = [msg("a", NOW - 3000), msg("b", NOW - 1000)];
    const { merged, incoming } = reconcilePoll(prev, fresh);
    expect(incoming.map((m) => m.id)).toEqual(["b"]);
    expect(merged.map((m) => m.id)).toEqual(["a"]);
  });

  it("drops known messages missing from the fetched window (deleted)", () => {
    const prev = [msg("a", NOW - 3000), msg("deleted", NOW - 2000)];
    const fresh = [msg("a", NOW - 3000), msg("c", NOW - 1000)];
    const { merged } = reconcilePoll(prev, fresh);
    expect(merged.map((m) => m.id)).toEqual(["a"]);
  });

  it("keeps messages older than the fetched window (paged-in history)", () => {
    const prev = [msg("old", NOW - 60_000), msg("a", NOW - 3000)];
    const fresh = [msg("a", NOW - 3000)];
    const { merged } = reconcilePoll(prev, fresh);
    expect(merged.map((m) => m.id)).toEqual(["old", "a"]);
  });

  it("keeps optimistic pending messages even when absent from the window", () => {
    const prev = [msg("a", NOW - 3000), msg("temp-1", NOW - 500, { pending: true })];
    const fresh = [msg("a", NOW - 3000), msg("b", NOW - 1000)];
    const { merged } = reconcilePoll(prev, fresh);
    expect(merged.some((m) => m.id === "temp-1")).toBe(true);
  });

  it("refreshes body/editedAt on known messages (edits propagate)", () => {
    const prev = [msg("a", NOW - 3000)];
    const fresh = [msg("a", NOW - 3000, { body: "edited!", editedAt: iso(NOW - 100) })];
    const { merged } = reconcilePoll(prev, fresh);
    expect(merged[0]!.body).toBe("edited!");
    expect(merged[0]!.editedAt).toBe(iso(NOW - 100));
  });

  it("handles an empty fetched window without dropping anything", () => {
    const prev = [msg("a", NOW - 3000)];
    const { merged, incoming } = reconcilePoll(prev, []);
    expect(merged.map((m) => m.id)).toEqual(["a"]);
    expect(incoming).toEqual([]);
  });
});

const counts = (a: number, b: number, c = 0) => [
  { optionId: "o1", count: a },
  { optionId: "o2", count: b },
  { optionId: "o3", count: c },
];

describe("applyPollVote", () => {
  it("adds a first-time vote", () => {
    expect(applyPollVote(counts(1, 2), null, "o1")).toEqual(counts(2, 2));
  });
  it("moves a vote between options", () => {
    expect(applyPollVote(counts(1, 2), "o2", "o1")).toEqual(counts(2, 1));
  });
  it("retracts a vote", () => {
    expect(applyPollVote(counts(1, 2), "o2", null)).toEqual(counts(1, 1));
  });
  it("never goes below zero", () => {
    expect(applyPollVote(counts(0, 0), "o1", null)).toEqual(counts(0, 0));
  });
});

describe("pollShares", () => {
  it("computes integer percentage shares", () => {
    const shares = pollShares(counts(1, 3));
    expect(shares.get("o1")).toBe(25);
    expect(shares.get("o2")).toBe(75);
    expect(shares.get("o3")).toBe(0);
  });
  it("is safe for zero totals", () => {
    const shares = pollShares(counts(0, 0));
    expect(shares.get("o1")).toBe(0);
  });
});

/**
 * The bug the owner filmed: open the room, see today's messages, and ten
 * seconds later be sitting in four-day-old history.
 *
 * `/community` server-renders the newest 30 messages; `/api/chat/messages`
 * returns the newest 50. So the first poll hands back ~20 messages that are
 * unknown AND older than everything on screen. They used to be treated as new
 * arrivals and appended below the newest message - and the room auto-scrolls
 * to the bottom.
 *
 * Reproduced in the browser before the fix:
 *   t= 0s  msgs=30  last=new-3   (today)
 *   t=10s  msgs=43  last=old-13  (Jul 30)
 */
describe("reconcilePoll - a wider poll window than the initial render", () => {
  const OLD = NOW - 4 * 24 * 60 * 60 * 1000; // four days ago

  it("keeps the newest message last when the poll reaches further back", () => {
    // On screen: the tail of the old day plus today's three.
    const prev = [msg("old-29", OLD + 29e3), msg("old-30", OLD + 30e3), msg("new-1", NOW - 3000)];
    // The poll window starts earlier and so includes history we never held.
    const fresh = [
      msg("old-27", OLD + 27e3),
      msg("old-28", OLD + 28e3),
      msg("old-29", OLD + 29e3),
      msg("old-30", OLD + 30e3),
      msg("new-1", NOW - 3000),
    ];
    const { merged, incoming } = reconcilePoll(prev, fresh);
    const final = [...merged, ...incoming].map((m) => m.id);

    // The whole point: today's message is still the last one on screen.
    expect(final[final.length - 1]).toBe("new-1");
    expect(final).toEqual(["old-27", "old-28", "old-29", "old-30", "new-1"]);
  });

  it("does not count backfilled history as unread or as a notification", () => {
    const prev = [msg("old-30", OLD + 30e3), msg("new-1", NOW - 3000)];
    const fresh = [msg("old-28", OLD + 28e3), msg("old-30", OLD + 30e3), msg("new-1", NOW - 3000)];
    // `incoming` drives the unread badge and the incoming-message sound.
    expect(reconcilePoll(prev, fresh).incoming).toEqual([]);
  });

  it("still reports a genuinely newer message as incoming", () => {
    const prev = [msg("old-30", OLD + 30e3), msg("new-1", NOW - 3000)];
    const fresh = [
      msg("old-28", OLD + 28e3),
      msg("old-30", OLD + 30e3),
      msg("new-1", NOW - 3000),
      msg("new-2", NOW - 500),
    ];
    const { merged, incoming } = reconcilePoll(prev, fresh);
    expect(incoming.map((m) => m.id)).toEqual(["new-2"]);
    expect([...merged, ...incoming].map((m) => m.id)).toEqual(["old-28", "old-30", "new-1", "new-2"]);
  });

  it("leaves an optimistic pending send at the end", () => {
    const prev = [msg("old-30", OLD + 30e3), msg("tmp", NOW, { pending: true })];
    const fresh = [msg("old-28", OLD + 28e3), msg("old-30", OLD + 30e3)];
    const { merged } = reconcilePoll(prev, fresh);
    expect(merged.map((m) => m.id)).toEqual(["old-28", "old-30", "tmp"]);
  });

  it("does not let a pending send hide a real new arrival", () => {
    // The optimistic message carries the local clock, so it must not be allowed
    // to set the high-water mark that decides what counts as new.
    const prev = [msg("a", NOW - 5000), msg("tmp", NOW + 10_000, { pending: true })];
    const fresh = [msg("a", NOW - 5000), msg("b", NOW - 1000)];
    expect(reconcilePoll(prev, fresh).incoming.map((m) => m.id)).toEqual(["b"]);
  });
});
