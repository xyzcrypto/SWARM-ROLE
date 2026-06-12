import { describe, it, expect } from "vitest";
import {
  chatMessageSchema,
  reactionSchema,
  REACTION_EMOJIS,
  CHAT_MAX_LENGTH,
  CHAT_PAGE_SIZE,
  CHAT_CHANNEL,
} from "@/lib/chat";

describe("chatMessageSchema", () => {
  it("accepts a normal message and trims it", () => {
    const out = chatMessageSchema.parse({ body: "  gm everyone 🚀  " });
    expect(out.body).toBe("gm everyone 🚀");
  });

  it("rejects empty / whitespace-only messages", () => {
    expect(chatMessageSchema.safeParse({ body: "" }).success).toBe(false);
    expect(chatMessageSchema.safeParse({ body: "   " }).success).toBe(false);
  });

  it("enforces the max length", () => {
    expect(chatMessageSchema.safeParse({ body: "x".repeat(CHAT_MAX_LENGTH) }).success).toBe(true);
    expect(chatMessageSchema.safeParse({ body: "x".repeat(CHAT_MAX_LENGTH + 1) }).success).toBe(false);
  });

  it("accepts an optional valid replyToId and rejects a malformed one", () => {
    const cuid = "c" + "a".repeat(24);
    expect(chatMessageSchema.safeParse({ body: "hi", replyToId: cuid }).success).toBe(true);
    expect(chatMessageSchema.safeParse({ body: "hi", replyToId: "nope" }).success).toBe(false);
    expect(chatMessageSchema.safeParse({ body: "hi", replyToId: null }).success).toBe(true);
    expect(chatMessageSchema.safeParse({ body: "hi" }).success).toBe(true);
  });

  it("rejects non-string bodies", () => {
    expect(chatMessageSchema.safeParse({ body: 123 }).success).toBe(false);
    expect(chatMessageSchema.safeParse({}).success).toBe(false);
  });
});

describe("reactionSchema", () => {
  it("accepts an allowlisted emoji", () => {
    expect(reactionSchema.safeParse({ emoji: REACTION_EMOJIS[0] }).success).toBe(true);
    expect(reactionSchema.safeParse({ emoji: "🔥" }).success).toBe(true);
  });
  it("rejects an emoji outside the allowlist", () => {
    expect(reactionSchema.safeParse({ emoji: "🍕" }).success).toBe(false);
    expect(reactionSchema.safeParse({ emoji: "x" }).success).toBe(false);
    expect(reactionSchema.safeParse({}).success).toBe(false);
  });
});

describe("chat constants", () => {
  it("are sane", () => {
    expect(CHAT_PAGE_SIZE).toBeGreaterThan(0);
    expect(CHAT_MAX_LENGTH).toBe(500);
    expect(CHAT_CHANNEL).toBe("community");
    expect(REACTION_EMOJIS.length).toBeGreaterThanOrEqual(6);
  });
});
