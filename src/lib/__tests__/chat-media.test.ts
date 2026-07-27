import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { chatMediaUrl } from "@/lib/chat-media";

// The storage branch used to be a substring test (`t.includes("/storage/v1/object/public/")`),
// so any host could satisfy it just by putting that path in its URL. Because a
// chat message body is broadcast to every connected client and re-rendered for
// every later viewer, that turned one message into an IP/User-Agent/timing
// harvest of the whole room. These tests pin the origin check.

const SUPABASE = "https://abcdefgh.supabase.co";
const STORAGE = `${SUPABASE}/storage/v1/object/public/post-covers/pic.png`;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE);
  vi.stubEnv("SUPABASE_URL", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("chatMediaUrl - storage origin check", () => {
  it("accepts an image from our own Supabase storage", () => {
    expect(chatMediaUrl(STORAGE)).toBe(STORAGE);
  });

  it("rejects an attacker host that merely contains the storage path", () => {
    expect(chatMediaUrl("https://attacker.example/storage/v1/object/public/x.gif")).toBeNull();
    // subdomain of the attacker, our host as a path segment, and our host as a
    // prefix of theirs - all near-misses the substring check would have allowed
    expect(chatMediaUrl("https://evil.co/abcdefgh.supabase.co/storage/v1/object/public/x.gif")).toBeNull();
    expect(chatMediaUrl("https://abcdefgh.supabase.co.evil.co/storage/v1/object/public/x.gif")).toBeNull();
  });

  it("rejects our origin when the path is not the public storage prefix", () => {
    expect(chatMediaUrl(`${SUPABASE}/rest/v1/rpc/anything`)).toBeNull();
    expect(chatMediaUrl(`${SUPABASE}/evil/storage/v1/object/public/x.gif`)).toBeNull();
  });

  it("fails closed when no Supabase origin is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_URL", "");
    expect(chatMediaUrl(STORAGE)).toBeNull();
    // ...but inline data images still render, which is what an unconfigured
    // deployment actually produces (storage.ts falls back to data: URLs).
    expect(chatMediaUrl("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });

  it("accepts via the server-only var when the public one is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_URL", SUPABASE);
    expect(chatMediaUrl(STORAGE)).toBe(STORAGE);
  });

  it("does not throw on malformed input", () => {
    expect(() => chatMediaUrl("https://")).not.toThrow();
    expect(chatMediaUrl("https://")).toBeNull();
    expect(chatMediaUrl("http://[")).toBeNull();
  });

  it("treats a malformed configured URL as not configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not a url");
    vi.stubEnv("SUPABASE_URL", "");
    expect(chatMediaUrl(STORAGE)).toBeNull();
  });
});

describe("chatMediaUrl - unchanged behaviour", () => {
  it("still accepts GIF-picker hosts", () => {
    const g = "https://media.giphy.com/media/abc/giphy.gif";
    expect(chatMediaUrl(g)).toBe(g);
    const t = "https://media.tenor.com/abc/x.gif";
    expect(chatMediaUrl(t)).toBe(t);
  });
  it("still rejects a bare pasted image link and any text with whitespace", () => {
    expect(chatMediaUrl("https://example.com/cat.png")).toBeNull();
    expect(chatMediaUrl(`look ${STORAGE}`)).toBeNull();
  });
});
