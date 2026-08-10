import { beforeEach, describe, expect, it, vi } from "vitest";

// Exercises the REAL /api/watchdog handler, not just the pure helper. The thing
// that has to be true is what an owner sees when they curl the deployed site, and
// that is a status code and a response body - so this asserts on those.
vi.mock("@/lib/env", () => ({
  env: { CRON_SECRET: "" },
  aiEnabled: false,
  googleEnabled: false,
  githubEnabled: false,
  twitterEnabled: false,
  storageEnabled: false,
  isAdminEmail: () => false,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { watchdogRun: { findFirst: async () => null, create: async () => ({}) } },
}));
vi.mock("@/lib/security-signals", () => ({
  collectSignals: async () => ({ windowMinutes: 60 }),
  scoreSignals: () => ({ severity: "ok", flags: [] }),
}));
vi.mock("@/lib/ai", () => ({ completeText: async () => null }));
vi.mock("@/lib/notify-owner", () => ({ notifyOwner: async () => null }));

import { env } from "@/lib/env";
import { GET } from "@/app/api/watchdog/route";

const SECRET = "real-secret";
const setSecret = (v: string) => {
  (env as { CRON_SECRET: string }).CRON_SECRET = v;
};
const call = (authorization?: string) =>
  GET(new Request("https://x.io/api/watchdog", authorization ? { headers: { authorization } } : undefined));

beforeEach(() => setSecret(""));

describe("GET /api/watchdog tells the owner which problem they have", () => {
  // ⚠️ This is the finding. Both of the next two cases used to answer an
  // identical `403 Forbidden`, so from outside there was no way to tell whether
  // the secret was wrong or simply absent from the running deployment. XYZ
  // Sentinel was dark for two weeks with its cause logged as "not yet pinned"
  // (HANDOFF §8), and one attempt to diagnose it recorded the wrong cause as a
  // fact and had to be retracted. A single unauthenticated request now answers it.
  it("503, naming CRON_SECRET, when the secret is absent from the runtime", async () => {
    const res = await call();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/CRON_SECRET/);
    expect(body.error).toMatch(/redeploy/i);
  });

  it("403 and nothing else when the secret is configured but the token is wrong", async () => {
    setSecret(SECRET);
    const res = await call("Bearer wrong");
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Forbidden");
  });

  it("200 when the token is correct", async () => {
    setSecret(SECRET);
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
  });

  // The 503 is a config disclosure, so it must stay a config disclosure: it may
  // never become a way to test candidate secrets.
  it("never echoes the configured secret", async () => {
    setSecret(SECRET);
    for (const auth of [undefined, "Bearer wrong", `Bearer ${SECRET.slice(0, 4)}`]) {
      const body = await (await call(auth)).text();
      expect(body).not.toContain(SECRET);
    }
  });
});
