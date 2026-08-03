import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fg from "fast-glob";

// Structural invariant: EVERY mutating API handler calls rateLimit().
//
// This is a per-HANDLER check, not per-file, because the bug it guards is
// specifically a file that limits one handler and not another. Two live
// examples at the time of writing: news/saved and news/social each throttled
// POST and left DELETE wide open, and three journal routes limited PATCH but
// not DELETE. A file-level grep reports all five as "has a limiter" and misses
// every one of them.
//
// Rate limiting is the only abuse control on these paths - there is no WAF and
// no per-account quota - and Upstash is verified live in production, so a
// missing limiter is a real gap rather than a theoretical one.
//
// If this fails: add `const { success } = await rateLimit("<bucket>", <key>);`
// plus a 429 to the named handler, reusing whatever bucket its sibling handler
// in the same file already uses. See src/lib/ratelimit.ts for the buckets.

const MUTATING = ["POST", "PATCH", "PUT", "DELETE"] as const;

type Handler = { file: string; name: string; body: string };

function mutatingHandlers(): Handler[] {
  const files = fg.sync("src/app/api/**/route.ts", { cwd: process.cwd(), absolute: false });
  const out: Handler[] = [];
  for (const file of files) {
    const src = readFileSync(join(process.cwd(), file), "utf8");
    const marks = [...src.matchAll(/^export async function (\w+)/gm)].map((m) => ({
      index: m.index ?? 0,
      name: m[1]!,
    }));
    marks.forEach((mark, i) => {
      if (!(MUTATING as readonly string[]).includes(mark.name)) return;
      const end = marks[i + 1]?.index ?? src.length;
      out.push({ file, name: mark.name, body: src.slice(mark.index, end) });
    });
  }
  return out;
}

describe("every mutating API handler is rate-limited", () => {
  const handlers = mutatingHandlers();

  it("finds handlers to check (guards against a silently empty sweep)", () => {
    // Without this, a broken glob would make the suite below vacuously pass -
    // the same false-negative shape the per-file grep had.
    expect(handlers.length).toBeGreaterThan(50);
  });

  it("calls rateLimit() in every POST/PATCH/PUT/DELETE handler", () => {
    const missing = handlers
      .filter((h) => !h.body.includes("rateLimit("))
      .map((h) => `${h.file}:${h.name}`);
    expect(missing).toEqual([]);
  });

  it("acts on the limiter result instead of ignoring it", () => {
    // A limiter whose result is never checked is worse than none - it reads as
    // protection while allowing everything through.
    //
    // Deliberately NOT asserting a 429: `posts/[id]/view` and `track` are
    // fire-and-forget beacons that drop excess pings with `return ok(...)`,
    // because a 429 there is browser console noise for no benefit. The
    // invariant is that `!success` short-circuits before the write, whatever
    // status it answers with.
    const unenforced = handlers
      .filter((h) => h.body.includes("rateLimit(") && !/if \(!success\)\s*return/.test(h.body))
      .map((h) => `${h.file}:${h.name}`);
    expect(unenforced).toEqual([]);
  });

  it("keeps the chat presence heartbeat out of the composer's bucket", () => {
    // The presence beat is unattended traffic: every 15s while realtime is down,
    // plus one on every tab wake. It used to spend the `chat` bucket, which is
    // the 10/min budget for SENDING - so a member typing normally in a room with
    // a dead socket could get "Too many requests" because their own heartbeat
    // had already spent a third of it. Any shared-bucket regression here shows
    // up as the chat looking broken, so pin it.
    const presence = handlers.find((h) => h.file.endsWith("api/chat/presence/route.ts"));
    expect(presence, "chat presence route should exist").toBeTruthy();
    expect(presence!.body).toContain('rateLimit("chatPresence"');
    expect(presence!.body).not.toContain('rateLimit("chat"');
  });
});
