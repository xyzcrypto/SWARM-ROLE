import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// NavActivity runs TWO poll loops per logged-in tab:
//
//   POLL_MS      (60s)  - full refresh, the backstop. Always on.
//   FAST_POLL_MS (30s)  - the two cheap unread counts.
//
// The fast loop exists only to cover realtime being dark. The server half of
// realtime is separate credentials from the browser half - broadcastEvent()
// needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY - and when those are unset it
// is a silent no-op while the client sits happily subscribed to a channel
// nothing will ever publish to. On that configuration the poll is the only
// thing that moves the DM badge.
//
// So the fast loop is gated on a broadcast having actually ARRIVED, which is
// the one signal that proves the whole path end-to-end. Once realtime is doing
// the job, the fast loop is duplicate work - two extra indexed queries per
// minute per logged-in tab, forever - and switches itself off.
//
// This is pinned by a test because the failure mode is invisible in both
// directions:
//   - forget to mark `proven()` on a NEW broadcast handler, and a tab that only
//     ever receives that event polls forever. Nothing errors; the bill grows.
//   - gate the FULL loop by mistake, and a session where realtime dies mid-way
//     has no backstop at all. Nothing errors; badges just stop.
// Neither shows up in a render test, and this project has no jsdom setup.

const SRC = readFileSync(
  join(process.cwd(), "src/modules/notifications/components/NavActivity.tsx"),
  "utf8"
);

/** Body of every `useLiveData({ ... })` call, in source order. */
function liveDataCalls(): string[] {
  return [...SRC.matchAll(/useLiveData\(\{([^}]*)\}\)/g)].map((m) => m[1]!);
}

describe("NavActivity adaptive polling", () => {
  it("still has both loops (guards against a silently empty parse)", () => {
    // If the call shape is refactored, every assertion below would vacuously
    // pass. Fail loudly instead.
    const calls = liveDataCalls();
    expect(calls.length).toBe(2);
    expect(SRC).toMatch(/const POLL_MS = [\d_]+;/);
    expect(SRC).toMatch(/const FAST_POLL_MS = [\d_]+;/);
  });

  it("keeps the FULL refresh loop ungated - it is the backstop", () => {
    const full = liveDataCalls().find((c) => c.includes("POLL_MS") && !c.includes("FAST_POLL_MS"));
    expect(full, "no useLiveData call using POLL_MS").toBeDefined();
    // An `enabled:` on this one would mean a session can end up with no
    // periodic refresh at all if realtime drops after being proven.
    expect(full).not.toMatch(/enabled\s*:/);
  });

  it("gates the FAST loop on realtime being proven", () => {
    const fast = liveDataCalls().find((c) => c.includes("FAST_POLL_MS"));
    expect(fast, "no useLiveData call using FAST_POLL_MS").toBeDefined();
    expect(fast).toMatch(/enabled\s*:\s*!realtimeProven/);
  });

  it("marks realtime proven from EVERY broadcast handler", () => {
    // The real regression risk: someone adds a fourth subscription and does not
    // mark it. A tab whose only traffic is that event then polls forever.
    //
    // `proven()` is the helper; `setRealtimeProven(true)` is accepted too so a
    // refactor that inlines it does not fail for the wrong reason.
    const handlers = [...SRC.matchAll(/\.onBroadcast\(\s*"([^"]+)"\s*,\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*\)/g)];
    expect(handlers.length).toBeGreaterThanOrEqual(3);

    const unmarked = handlers
      .filter(([, , body]) => !/proven\(\)|setRealtimeProven\(\s*true\s*\)/.test(body!))
      .map(([, event]) => event);

    expect(unmarked, `broadcast handler(s) that never mark realtime proven: ${unmarked.join(", ")}`).toEqual([]);
  });

  it("only ever sets proven to true - never flips it back", () => {
    // Deliberately one-way. "Realtime stopped" and "the room is quiet" are
    // indistinguishable from the client, so a loop that re-enables on silence
    // would oscillate. Falling back to POLL_MS plus useLiveData's own
    // focus/visibility/online refetch is the intended degraded path.
    const sets = [...SRC.matchAll(/setRealtimeProven\(\s*([^)]*)\s*\)/g)].map((m) => m[1]!.trim());
    expect(sets.length).toBeGreaterThan(0);
    expect(sets.filter((v) => v !== "true")).toEqual([]);
  });
});
