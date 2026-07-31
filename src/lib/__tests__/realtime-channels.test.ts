import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CH_SITE, CH_MEMBERS, CH_NOTIFY, userChannel } from "../realtime-channels";

// `realtime-channels.ts` exists so `"use client"` components can name a channel
// without dragging `@/lib/env` into the browser bundle (see the note in that
// file, and env.ts's `import "server-only"`).
//
// The build already fails if a client component reaches a server-only module,
// so the main regression is covered. What the build CANNOT tell you is whether
// this module has quietly grown an import that happens to be browser-safe today
// and won't be after someone edits it. Hence the no-imports assertion: it keeps
// the file's "keep this free of imports" comment enforceable rather than
// aspirational.

const SRC = readFileSync(join(process.cwd(), "src/lib/realtime-channels.ts"), "utf8");

// Match import STATEMENTS only. The first version of this test regex-searched
// the whole file for "@/lib/env" and "server-only" and failed on its own
// explanatory comment, which names both. Comments describing what must not be
// imported are exactly what this file should contain.
const importLines = [...SRC.matchAll(/^\s*import\s.+$/gm)].map((m) => m[0].trim());

describe("realtime-channels stays browser-safe", () => {
  it("has no imports at all", () => {
    expect(importLines).toEqual([]);
  });

  it("in particular imports nothing server-side", () => {
    const bad = importLines.filter((l) => /@\/lib\/env|@\/lib\/prisma|server-only/.test(l));
    expect(bad).toEqual([]);
  });
});

describe("channel names are stable", () => {
  // Server broadcasts and client subscriptions must agree on these strings; a
  // rename on one side silently stops delivery rather than erroring.
  it("keeps the wire-format topic names", () => {
    expect(CH_SITE).toBe("site-visitors");
    expect(CH_MEMBERS).toBe("members");
    expect(CH_NOTIFY).toBe("notifications");
    expect(userChannel("abc123")).toBe("user:abc123");
  });
});
