import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { probeSaysReload } from "@shared/utils/recover";

const read = (p: string) => readFileSync(p, "utf8");

describe("first-load JS stays lean (pages become tappable sooner on mobile data)", () => {
  it("Sentry is never imported statically into the client: it loads only when a DSN exists", () => {
    for (const f of ["src/instrumentation-client.ts", "src/app/error.tsx", "src/app/global-error.tsx"]) {
      expect(read(f), f).not.toMatch(/from "@sentry\/nextjs"/);
    }
    const r = read("src/shared/utils/report-error.ts");
    expect(r).toMatch(/if \(!DSN\) return null;/);
    expect(r).toMatch(/import\("@sentry\/nextjs"\)/);
  });

  it("Fraunces is declared by the one headline that uses it, not by the root layout", () => {
    expect(read("src/app/layout.tsx")).not.toMatch(/Fraunces/);
    expect(read("src/components/Hero.tsx")).toMatch(/const fraunces = Fraunces\(/);
  });

  it("nothing imports the AI widget module just for its event name", () => {
    for (const f of [
      "src/shared/components/Navbar.tsx",
      "src/shared/components/AppMenu.tsx",
      "src/shared/components/CommandPalette.tsx",
      "src/modules/news/components/NewsLayout.tsx",
      "src/modules/markets/components/AIMarketIntelligenceCard.tsx",
    ]) {
      const s = read(f);
      expect(s, f).not.toMatch(/from "@\/components\/XyzAiWidget"/);
      expect(s, f).not.toMatch(/from "@modules\/ai\/components\/XyzAiWidget"/);
    }
    expect(read("src/modules/ai/lib/events.ts")).toMatch(/export const XYZ_AI_OPEN_EVENT = "xyz-ai:open";/);
  });
});

describe("solo quiz re-syncs even when the connection returns mid-request", () => {
  const q = read("src/modules/academy/components/QuizClient.tsx");
  it("a re-sync asked for while busy is remembered and run when the request settles", () => {
    expect(q).toMatch(/if \(busyRef\.current\) syncPending\.current = true;/);
    expect(q).toMatch(/if \(!busy && syncPending\.current\) \{\s*syncPending\.current = false;\s*void load\(\);/);
    expect(q).not.toMatch(/!busyRef\.current\) void load\(\)/);
  });
  it("starting a quiz survives one dropped connection instead of asking for another tap", () => {
    expect(q).toMatch(/const r = await withRetry\(\(\) =>\s*postJson<\{ attemptId: string; done: boolean \}>\(\s*"\/api\/academy\/quiz",/);
    expect(q.match(/action: "finish" \}\), FINISH_TRIES\)/g)?.length).toBe(3);
  });
  it("50:50 fails fast and re-syncs when the server already moved on", () => {
    expect(q).toMatch(/action: "fifty", index: q\.index \}, \{ timeoutMs: QUIZ_TIMEOUT_MS \}/);
  });
});

describe("a chunk that fails while offline never reloads the tab into the browser's error page", () => {
  it("reloads only on an answer that means a reload will work", () => {
    expect(probeSaysReload(200)).toBe(true); // network back, file there
    expect(probeSaysReload(204)).toBe(true);
    expect(probeSaysReload(404)).toBe(true); // deployment gone: reload picks up the new one
    expect(probeSaysReload(410)).toBe(true);
    expect(probeSaysReload(null)).toBe(false); // no answer: still offline
    expect(probeSaysReload(502)).toBe(false);
    expect(probeSaysReload(503)).toBe(false);
  });
  it("waits for the network before probing, and probes with HEAD so the service worker cannot answer from cache", () => {
    const r = read("src/shared/utils/recover.ts");
    expect(r).toMatch(/if \(!navigator\.onLine\) \{\s*window\.addEventListener\("online"/);
    expect(r).toMatch(/method: "HEAD", cache: "no-store"/);
    expect(read("public/sw.js")).toMatch(/if \(req\.method !== "GET"\) return;/);
  });
  it("every automatic chunk-error reload goes through it", () => {
    for (const f of ["src/modules/notifications/components/PwaSetup.tsx", "src/app/error.tsx", "src/app/global-error.tsx"]) {
      const s = read(f);
      expect(s, f).toMatch(/reloadWhenReachable/);
      expect(s, f).not.toMatch(/reloadForNewDeploy\(/);
    }
  });
});
