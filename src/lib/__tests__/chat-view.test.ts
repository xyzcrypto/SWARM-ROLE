import { describe, expect, it } from "vitest";
import { EDIT_WINDOW_MS, canEditMessage, reconcilePoll } from "@/lib/chat-view";

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
