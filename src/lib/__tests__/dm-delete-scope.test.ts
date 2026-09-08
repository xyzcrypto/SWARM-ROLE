import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Three defects in the DM thread, all of which made the delete feature behave
// as something other than what it looked like.
//
// 1. **Anyone could delete anyone's message, for both sides.** The DELETE
//    handler had no `senderId` check - only "are you one of the two
//    participants" - while the PATCH handler directly above it did. The comment
//    called this "Telegram / WhatsApp style"; neither of those lets you erase
//    the other person's words.
//
// 2. **Deletes, edits and pins never reached the other participant.** The
//    thread's silent refetch bailed out on `next.length === prev.length`, and a
//    DM delete is SOFT, so the count never changes. Nor does an edit or a pin.
//    Every 5s poll and every realtime ping threw the fresh payload away - the
//    exact three things the message route broadcasts for.
//
// 3. **Deleting an older message corrupted the inbox preview.** The guard was
//    `lastSenderId === msg.senderId` - "was the deleted message's sender also
//    the last sender" - which is a different question from "was this the last
//    message". Send m1 then m2, delete m1, and the preview read "Message
//    deleted" while m2 was still the newest.
//
// Real source paths on purpose: `src/components/*` and `src/lib/*` are
// re-export shims after #203.
const route = readFileSync("src/app/api/dm/[id]/message/[messageId]/route.ts", "utf8");
const thread = readFileSync("src/app/api/dm/[id]/route.ts", "utf8");
const client = readFileSync("src/modules/messages/components/MessagesClient.tsx", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/35_dm_delete_for_me/migration.sql", "utf8");
const strip = (s: string) => s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ");
const R = strip(route);
const T = strip(thread);
const C = strip(client);

describe("delete for everyone is your own messages only", () => {
  it("refuses someone else's message", () => {
    expect(R).toMatch(/msg\.senderId !== me\.id[\s\S]{0,160}403/);
  });

  it("defaults to the narrower scope", () => {
    // An old client that sends no scope must remove the message for itself,
    // not for both sides - the safe direction for a default to fail in.
    expect(R).toMatch(/searchParams\.get\("scope"\) === "everyone" \? "everyone" : "me"/);
  });

  it("still deletes softly, so a reported message survives", () => {
    expect(R).toMatch(/status: "deleted", pinnedAt: null/);
  });
});

describe("delete for me is per-side and private", () => {
  it("writes the flag for whichever participant asked", () => {
    expect(R).toMatch(/iAmUserA \? \{ hiddenByA: true \} : \{ hiddenByB: true \}/);
  });

  it("tells the other side nothing", () => {
    // For them nothing happened; a broadcast would leak that I hid something,
    // and their inbox preview is still accurate.
    const me = /if \(scope === "me"\) \{[\s\S]*?return ok\(/.exec(R)?.[0] ?? "";
    expect(me).not.toBe("");
    expect(me).not.toContain("broadcastEvent");
    expect(me).not.toContain("lastBody");
  });

  it("filters on the server, not in the client", () => {
    // Filtering client-side would still ship the body to a reader who asked
    // never to see it again - the same mistake as hiding a deleted body in CSS.
    expect(T).toMatch(/const notHiddenForMe = iAmUserA \? \{ hiddenByA: false \} : \{ hiddenByB: false \}/);
    expect(T).toMatch(/where: \{ conversationId: conv\.id, \.\.\.notHiddenForMe \}/);
    // ...including the pinned banner, or it points at a message I cannot see.
    expect(T).toMatch(/pinnedAt: \{ not: null \}, \.\.\.notHiddenForMe/);
  });

  it("has a column, an index and an idempotent migration", () => {
    expect(schema).toMatch(/hiddenByA\s+Boolean\s+@default\(false\)/);
    expect(schema).toMatch(/hiddenByB\s+Boolean\s+@default\(false\)/);
    expect(schema).toMatch(/@@index\(\[conversationId, hiddenByA, createdAt\]\)/);
    // Additive with a default, so existing rows need no backfill, and re-runnable
    // because `db push` may apply it more than once.
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "hiddenByA" BOOLEAN NOT NULL DEFAULT false/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "hiddenByB" BOOLEAN NOT NULL DEFAULT false/);
    expect(migration).toMatch(/CREATE INDEX IF NOT EXISTS/);
  });
});

describe("the other side actually sees a delete, edit or pin", () => {
  it("compares what renders, not how many rows there are", () => {
    expect(C).toContain("sameThread(prev, next)");
    // The length-only shortcut is what made soft deletes invisible.
    expect(C).not.toMatch(/if \(silent && next\.length === prev\.length\) return prev;/);
  });

  it("compares every field a refetch can change in place", () => {
    const fn = /function sameThread\([\s\S]*?\n\}/.exec(C)?.[0] ?? "";
    expect(fn).not.toBe("");
    for (const field of ["id", "body", "deleted", "pinned", "editedAt"]) {
      expect(fn, `sameThread ignores ${field}`).toContain(field);
    }
  });
});

describe("the inbox preview follows the newest message", () => {
  it("recomputes instead of guessing from the sender", () => {
    expect(R).toMatch(/orderBy: \{ createdAt: "desc" \}/);
    expect(R).toMatch(/lastBody: newest\.status === "deleted" \? "Message deleted" : snippet\(newest\.body\)/);
    // The guard that asked the wrong question.
    expect(R).not.toMatch(/if \(msg\.conversation\.lastSenderId === msg\.senderId\)/);
  });
});

describe("the menu offers what the server will accept", () => {
  it("offers only 'for me' on their message", () => {
    // Offering "for everyone" there would be a button that only ever 403s.
    const theirs = /\{!m\.mine && !m\.deleted && \([\s\S]*?<\/MessageActions>/.exec(C)?.[0] ?? "";
    expect(theirs).not.toBe("");
    expect(theirs).toContain('deleteMessage(m.id, "me")');
    expect(theirs).not.toContain('deleteMessage(m.id, "everyone")');
  });

  it("offers both on mine", () => {
    expect(C).toContain('label="Delete for everyone"');
    expect(C.match(/label="Delete for me"/g) ?? []).toHaveLength(2);
  });

  it("removes rather than tombstones when the scope is me", () => {
    // For me it is not "deleted", it is no longer mine to see - a tombstone
    // would be describing the other person's thread, not mine.
    expect(C).toMatch(/scope === "me"[\s\S]{0,260}m\.filter\(\(x\) => x\.id !== messageId\)/);
  });
});
