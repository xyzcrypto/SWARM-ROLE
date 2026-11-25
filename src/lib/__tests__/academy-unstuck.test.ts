import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { withRetry } from "@modules/academy/client/hooks";

const read = (p: string) => readFileSync(p, "utf8");

describe("withRetry (quiz never sits on a dead request)", () => {
  it("retries a dropped connection and a 5xx, then succeeds", async () => {
    vi.useFakeTimers();
    let n = 0;
    const p = withRetry(async () => {
      n++;
      if (n === 1) throw Object.assign(new Error("offline"), { status: 0 });
      if (n === 2) throw Object.assign(new Error("cold start"), { status: 503 });
      return "ok";
    });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe("ok");
    expect(n).toBe(3);
    vi.useRealTimers();
  });

  it("does not retry a 4xx: the server said no", async () => {
    let n = 0;
    await expect(
      withRetry(async () => {
        n++;
        throw Object.assign(new Error("already answered"), { status: 409 });
      })
    ).rejects.toThrow("already answered");
    expect(n).toBe(1);
  });
});

describe("no-stuck guards stay in place", () => {
  it("audio: every piece ends exactly once, and a stalled clip cannot silence AneQue", () => {
    const a = read("src/modules/academy/client/audio.ts");
    expect(a).toMatch(/let settled = false/);
    expect(a).toMatch(/watchdog = setTimeout\(fallback, piece\.neural \? 16000 : 8000\)/);
    expect(a).toMatch(/name === "AbortError"/);
  });
  it("quiz: every step retries, and coming back to the tab re-syncs", () => {
    const q = read("src/modules/academy/components/QuizClient.tsx");
    expect(q.match(/withRetry\(/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
    expect(q).toMatch(/visibilitychange/);
  });
  it("navigation: a soft navigation stuck on the server falls back to a full load", () => {
    const n = read("src/shared/components/NavProgress.tsx");
    expect(n).toMatch(/navStartedAt\.get\(path\)/);
    // programmatic navigations (router.push) are covered too
    expect(n).toMatch(/pendingNavs/);
    expect(n).toMatch(/window\.location\.assign\(href\)/);
  });
  it("no hand-rolled body scroll locks (they freeze the page when overlays close out of order)", () => {
    for (const f of [
      "src/modules/community/components/ChatAppearanceSheet.tsx",
      "src/modules/community/components/ReportDialog.tsx",
      "src/modules/markets/components/MarketHeatmap.tsx",
      "src/modules/points/components/AirdropBriefModal.tsx",
    ])
      expect(read(f), f).not.toMatch(/document\.body\.style\.overflow\s*=/);
  });
});
