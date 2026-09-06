import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { backoffDelay, wakeIsDue } from "@/lib/useLiveData";

describe("backoffDelay", () => {
  it("makes the first retry fast - a blip should cost a second, not a poll cycle", () => {
    // The bug this exists for: every live surface waited out its whole interval
    // after a failed request (30-90s), and if the next one failed too it stayed
    // stale until the user reloaded.
    expect(backoffDelay(1)).toBe(1000);
  });

  it("doubles, so a genuinely down backend is not hammered", () => {
    expect(backoffDelay(2)).toBe(2000);
    expect(backoffDelay(3)).toBe(4000);
    expect(backoffDelay(4)).toBe(8000);
  });

  it("caps at 30s, so a long outage never leaves a surface unattended for minutes", () => {
    expect(backoffDelay(10)).toBe(30_000);
    expect(backoffDelay(50)).toBe(30_000);
  });

  it("is defensive about a zero or negative count", () => {
    expect(backoffDelay(0)).toBe(1000);
    expect(backoffDelay(-3)).toBe(1000);
  });
});

describe("wakeIsDue", () => {
  // The bug: the wake path collapsed the three events that fire together
  // (visibilitychange + focus + online) with a flat 3s throttle, and did
  // nothing else. So any surface whose data is cached for minutes still
  // refetched on every glance at the tab.
  //
  // /markets is where that shows: nine of these loops run on it - six hub
  // feeds, two perp charts, the shared ticker - and every route behind them
  // caches for 150-300s. A three-second app switch on a phone fired nine
  // requests that could not contain anything new.
  const now = 1_000_000;

  it("still collapses the three simultaneous wake events", () => {
    expect(wakeIsDue(now, now)).toBe(false);
    expect(wakeIsDue(now + 2999, now)).toBe(false);
    expect(wakeIsDue(now + 3000, now)).toBe(true);
  });

  it("refuses a wake that is younger than the caller's poll window", () => {
    // The markets case: away for 300ms against a 180s window.
    expect(wakeIsDue(now + 300, now, 180_000)).toBe(false);
    expect(wakeIsDue(now + 179_999, now, 180_000)).toBe(false);
  });

  it("allows it once the window has actually elapsed", () => {
    // Still the behaviour the wake listener exists for: a reader who leaves for
    // longer than the window gets fresh data the moment they come back.
    expect(wakeIsDue(now + 180_000, now, 180_000)).toBe(true);
    expect(wakeIsDue(now + 600_000, now, 180_000)).toBe(true);
  });

  it("never drops below the 3s floor, whatever the caller passes", () => {
    // A surface that wants an eager wake (a DM thread, notification badges)
    // passes nothing, or something small; it must not lose event collapsing.
    expect(wakeIsDue(now + 500, now, 0)).toBe(false);
    expect(wakeIsDue(now + 500, now, 100)).toBe(false);
    expect(wakeIsDue(now + 3000, now, 100)).toBe(true);
  });

  it("is opt-in, so eager surfaces are unchanged", () => {
    // Default = the old 3s behaviour exactly. This matters: making the gate
    // universal would have delayed new messages appearing when you come back
    // to a DM tab, trading one bug for a worse one.
    expect(wakeIsDue(now + 3000, now, undefined)).toBe(true);
  });
});

describe("the markets pollers are on the shared loop", () => {
  // The hook's own doc comment names markets in the audit it was written for,
  // but only NavActivity had ever been moved onto it - so markets kept its
  // hand-rolled loops, with no retry and an ungated wake.
  //
  // Real source paths on purpose: `src/components/*` and `src/lib/*` are
  // re-export shims after #203, so reading one matches nothing and passes.
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  const sites: Record<string, string> = {
    "markets hub (x6 feeds)": "src/modules/markets/components/MarketsClient.tsx",
    "perp chart (x2 per page)": "src/modules/markets/components/PerpChart.tsx",
    "coin detail": "src/modules/markets/components/CoinDetailClient.tsx",
    "protocol detail": "src/modules/markets/components/ProtocolDetailClient.tsx",
  };

  for (const [name, path] of Object.entries(sites)) {
    it(`${name} uses useLiveData with an age-gated wake`, () => {
      const src = strip(readFileSync(path, "utf8"));
      expect(src).toMatch(/useLiveData\(\{ load, intervalMs: (\w+), wakeMinAgeMs: \1 \}\)/);
      // No hand-rolled listener left beside it - that is how nine accumulated.
      expect(src).not.toMatch(/addEventListener\("visibilitychange"/);
      // No hand-rolled POLL either. The 1s clocks behind the "updated Ns ago"
      // pills are intervals too and are meant to stay, so match on the shape
      // that fetches rather than on `setInterval` alone.
      expect(src).not.toMatch(/setInterval\([^)]*load\(\)/);
    });

    it(`${name} throws on failure, so a blip costs a second not a cycle`, () => {
      const src = strip(readFileSync(path, "utf8"));
      expect(src).toMatch(/throw (new Error|e)/);
    });
  }

  it("the shared ticker store keeps its own loop but borrows the wake rule", () => {
    // It is a module-level store deduped across every consumer on the page, so
    // there is no component to own a hook - but the wake bug was identical.
    const src = strip(readFileSync("src/modules/markets/lib/useTickerPoll.ts", "utf8"));
    expect(src).toMatch(/wakeIsDue\(Date\.now\(\), lastRunAt, POLL_MS\)/);
    expect(src).toMatch(/lastRunAt = Date\.now\(\)/);
  });
});
