import { describe, it, expect } from "vitest";
import { chatMessageSchema, CHAT_MAX_LENGTH, CHAT_PAGE_SIZE, CHAT_CHANNEL } from "@/lib/chat";

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

  it("rejects non-string bodies", () => {
    expect(chatMessageSchema.safeParse({ body: 123 }).success).toBe(false);
    expect(chatMessageSchema.safeParse({}).success).toBe(false);
  });
});

describe("chat constants", () => {
  it("are sane", () => {
    expect(CHAT_PAGE_SIZE).toBeGreaterThan(0);
    expect(CHAT_MAX_LENGTH).toBe(500);
    expect(CHAT_CHANNEL).toBe("community");
  });
});
