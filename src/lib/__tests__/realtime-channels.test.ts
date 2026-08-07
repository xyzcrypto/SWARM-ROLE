import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// Imported through the `src/lib` shim ON PURPOSE, unlike the file read below.
// These four assertions are about runtime VALUES, so going through the shim also
// proves the shim forwards them — which is worth covering, since app code still
// imports from this path.
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

// ⚠️ READ THE REAL MODULE, NOT THE `src/lib` PATH.
//
// This used to read "src/lib/realtime-channels.ts". Since #203 that path is a
// one-line re-export shim:
//
//     export * from "@core/realtime/realtime-channels";
//
// A shim contains no `import` statements — it re-exports — so `importLines`
// below came out as `[]` and BOTH assertions in the first describe block passed
// against an empty array. The file they exist to guard was never opened. Adding
// `import { env } from "@/lib/env"` to the real module left this suite green.
//
// That is the shim hazard in its exact form: a regex check pointed at a shim
// matches nothing, and "nothing matched" is indistinguishable from "nothing is
// wrong". The same near-miss hit markets-poll-alignment.test.ts (#236).
const REAL = "src/core/realtime/realtime-channels.ts";
const SRC = readFileSync(join(process.cwd(), REAL), "utf8");

// Match import STATEMENTS only. The first version of this test regex-searched
// the whole file for "@/lib/env" and "server-only" and failed on its own
// explanatory comment, which names both. Comments describing what must not be
// imported are exactly what this file should contain.
const importLines = [...SRC.matchAll(/^\s*import\s.+$/gm)].map((m) => m[0].trim());

describe("realtime-channels stays browser-safe", () => {
  // Runs FIRST and deliberately so: every assertion below is of the form "this
  // pattern does not appear", which an empty or wrong file satisfies trivially.
  // This is the guard that makes the rest of the suite mean something — the same
  // role `expect(creates.length).toBeGreaterThanOrEqual(6)` plays in
  // journal-activity-revocation.test.ts.
  it("is reading the real module, not a shim or a missing file", () => {
    expect(SRC.length, `${REAL} is empty or unreadable — every check below is vacuous`).toBeGreaterThan(200);

    // A shim's whole body is a re-export. If this matches, the path went stale
    // again and we are back to checking nothing.
    expect(SRC, `${REAL} looks like a re-export shim, not the implementation`).not.toMatch(
      /^\s*export\s+\*\s+from/m
    );

    // ...and the implementation really is here: a known export, defined (`=`),
    // not merely named in a comment or forwarded.
    expect(SRC, `${REAL} does not define CH_SITE — wrong file?`).toMatch(/export const CH_SITE\s*=/);
  });

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
