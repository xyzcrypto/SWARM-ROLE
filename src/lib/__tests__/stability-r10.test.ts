import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { needsWake } from "@modules/academy/client/audio";

const read = (p: string) => readFileSync(p, "utf8");

describe("audio engine wakes from every stopped state (voice no longer disappears after a call, lock or app switch)", () => {
  it("anything but running or closed needs waking, including iOS 'interrupted'", () => {
    expect(needsWake("suspended")).toBe(true);
    expect(needsWake("interrupted")).toBe(true);
    expect(needsWake("running")).toBe(false);
    expect(needsWake("closed")).toBe(false);
  });
  const a = read("src/modules/academy/client/audio.ts");
  it("wakes on visibility, pageshow, focus and any tap", () => {
    expect(a).not.toMatch(/if \(ctx\.state === "suspended"\) void ctx\.resume\(\)/);
    for (const ev of ['"visibilitychange"', '"pageshow"', '"focus"', '"pointerdown"']) expect(a, ev).toContain(`addEventListener(${ev}`);
  });
  it("plays AneQue on a plain element while the engine cannot run, so she is never silent", () => {
    expect(a).toMatch(/function voiceEl\(\): HTMLAudioElement/);
    expect(a).toMatch(/if \(!clipSource \|\| !ctx \|\| !needsWake\(ctx\.state\)\) return routed;/);
    expect(a).toMatch(/const a = voiceEl\(\);/);
  });
  it("a clip whose time stops moving is finished instead of blocking the queue forever", () => {
    expect(a).toMatch(/const moving = a\.currentTime > lastT \+ 0\.05;/);
    expect(a).toMatch(/if \(!a\.paused && moving && a\.currentTime < a\.duration - 0\.25\) return arm\(\);/);
  });
});

describe("live quiz keeps up on a weak connection", () => {
  const l = read("src/modules/academy/components/LiveArena.tsx");
  it("requests fail fast and the phase sync keeps trying until the question arrives", () => {
    expect(l).toMatch(/export const LIVE_TIMEOUT_MS = 4_000;/);
    expect(l).toMatch(/getJson<LiveState>\(`\/api\/academy\/live\/\$\{id\}`, \{ timeoutMs: LIVE_TIMEOUT_MS \}\)/);
    expect(l).toMatch(/if \(tries < 60\) timer = setTimeout\(attempt/);
    expect(l).not.toMatch(/tries < 6\)/);
    expect(l).toMatch(/alive = false;\s*clearTimeout\(timer\);/);
  });
  it("re-syncs when the tab comes back or the network returns", () => {
    expect(l).toMatch(/window\.addEventListener\("online", on\)/);
    expect(l).toMatch(/void loadAll\(4\)/);
  });
  it("a lost reply to an answer is not shown as an error", () => {
    expect(l).toMatch(/already answered\/i\.test/);
  });
});

describe("solo quiz: the last step is patient and recovers by itself", () => {
  const q = read("src/modules/academy/components/QuizClient.tsx");
  it("finishing retries more and the quiz re-syncs when the connection returns", () => {
    expect(q).toMatch(/const FINISH_TRIES = 5;/);
    expect(q.match(/action: "finish" \}\), FINISH_TRIES\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(q).toMatch(/window\.addEventListener\("online", online\)/);
  });
});

describe("service worker never makes a page wait for it to boot", () => {
  const sw = read("public/sw.js");
  it("API and in-app navigation requests bypass the worker (static routes)", () => {
    expect(sw).toMatch(/event\.addRoutes\(/);
    expect(sw).toMatch(/pathname: "\/api\/\*"/);
    expect(sw).toMatch(/search: "\*_rsc=\*"/);
  });
  it("full page loads use navigation preload, with the offline page as fallback", () => {
    expect(sw).toMatch(/navigationPreload\.enable\(\)/);
    expect(sw).toMatch(/await event\.preloadResponse/);
    expect(sw).toMatch(/caches\.match\(OFFLINE_URL\)/);
  });
  it("still never caches navigations", () => {
    expect(sw).not.toMatch(/c\.put\(req[^)]*\)[\s\S]{0,40}navigate/);
  });
});
