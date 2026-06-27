import { describe, it, expect } from "vitest";
import { realtimeMode } from "@/lib/useRealtime";

// The hook is effectful (Supabase client + timers), but its core decision —
// realtime when configured, else poll, else off — is pure and worth pinning.
describe("realtimeMode", () => {
  it("uses realtime when both url and key are present", () => {
    expect(realtimeMode("https://x.supabase.co", "anon-key")).toBe("realtime");
    expect(realtimeMode("https://x.supabase.co", "anon-key", 30_000)).toBe("realtime");
  });

  it("falls back to polling when realtime is unavailable but pollMs is set", () => {
    expect(realtimeMode(undefined, undefined, 30_000)).toBe("poll");
    expect(realtimeMode("https://x.supabase.co", undefined, 5_000)).toBe("poll");
    expect(realtimeMode("", "", 1_000)).toBe("poll");
  });

  it("does nothing when neither realtime nor a poll interval is available", () => {
    expect(realtimeMode(undefined, undefined)).toBe("off");
    expect(realtimeMode("https://x.supabase.co", null)).toBe("off");
    expect(realtimeMode(null, null, 0)).toBe("off");
  });
});
