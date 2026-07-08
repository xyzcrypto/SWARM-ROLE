import { describe, it, expect } from "vitest";
import { orderPair, snippet, otherOf, isUnread } from "@/lib/dm";

describe("orderPair", () => {
  it("orders a pair canonically regardless of argument order", () => {
    const a = orderPair("aaa", "bbb");
    const b = orderPair("bbb", "aaa");
    expect(a).toEqual({ userAId: "aaa", userBId: "bbb" });
    expect(b).toEqual({ userAId: "aaa", userBId: "bbb" });
  });
});

describe("snippet", () => {
  it("collapses whitespace and trims", () => {
    expect(snippet("  hello\n\n  world  ")).toBe("hello world");
  });
  it("truncates long bodies with an ellipsis", () => {
    const s = snippet("x".repeat(200), 10);
    expect(s.endsWith("…")).toBe(true);
    expect(s.length).toBe(10);
  });
});

describe("otherOf", () => {
  const conv = {
    userAId: "me",
    userBId: "you",
    userA: { id: "me", name: "Me", username: "me", image: null },
    userB: { id: "you", name: "You", username: "you", image: null },
    readAAt: new Date("2026-01-01"),
    readBAt: null,
  };
  it("returns the other side + my read mark when I am A", () => {
    const r = otherOf(conv, "me");
    expect(r.iAmA).toBe(true);
    expect(r.other?.id).toBe("you");
    expect(r.myReadAt).toEqual(new Date("2026-01-01"));
  });
  it("returns the other side when I am B", () => {
    const r = otherOf(conv, "you");
    expect(r.iAmA).toBe(false);
    expect(r.other?.id).toBe("me");
    expect(r.myReadAt).toBeNull();
  });
});

describe("isUnread", () => {
  const base = { userAId: "me", lastMessageAt: new Date("2026-02-02"), readAAt: null as Date | null, readBAt: null as Date | null };
  it("is not unread when the last message is mine", () => {
    expect(isUnread({ ...base, lastSenderId: "me" }, "me")).toBe(false);
  });
  it("is unread when the other sent last and I never read", () => {
    expect(isUnread({ ...base, lastSenderId: "you" }, "me")).toBe(true);
  });
  it("is read when my read mark is newer than the last message", () => {
    expect(isUnread({ ...base, lastSenderId: "you", readAAt: new Date("2026-03-03") }, "me")).toBe(false);
  });
  it("is unread when a newer message arrived after my read mark", () => {
    expect(isUnread({ ...base, lastSenderId: "you", readAAt: new Date("2026-01-01") }, "me")).toBe(true);
  });
});
