import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// The last two open bugs from the ten-item pass.
//
// 1. A message the AI filter hid was byte-identical to one a human hid, so a
//    false positive could not be told from a deliberate staff decision - and
//    the only bulk recovery, "Restore all hidden", undid both.
// 2. Two writers own one `ChatPresence` row and fought over its `room`.
//
// Real source paths on purpose: `src/components/*` and `src/lib/*` are
// re-export shims after #203.
const strip = (s: string) => s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ");
const read = (p: string) => strip(readFileSync(p, "utf8"));
const send = read("src/app/api/chat/messages/route.ts");
const mod = read("src/app/api/chat/messages/moderate/route.ts");
const dash = read("src/modules/dashboard/components/DashboardClient.tsx");
const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/36_chat_hidden_by/migration.sql", "utf8");
const sitePresence = read("src/app/api/presence/route.ts");

describe("a hidden message records who hid it", () => {
  it("has somewhere to record it", () => {
    expect(schema).toMatch(/hiddenBy {2}String\?/);
  });

  it("adds the column additively and idempotently", () => {
    // Nullable with no backfill: messages hidden before this shipped genuinely
    // have no known author, and inventing one would be worse than saying so.
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "hiddenBy" TEXT;/);
    expect(migration).not.toMatch(/NOT NULL/);
  });

  it("the AI filter signs its work", () => {
    // This write was `{ status: "hidden" }` - identical to a moderator's.
    expect(send).toMatch(/data: \{ status: "hidden", hiddenBy: "ai" \}/);
  });

  it("a moderator's hide records the moderator", () => {
    expect(mod).toMatch(/data: \{ status: nextStatus, hiddenBy: action === "hide" \? actor\.id : null \}/);
  });

  it("restoring clears it", () => {
    // A visible message has not been hidden by anyone; leaving the old value
    // would make a restored message look like it was still someone's call.
    expect(mod).toMatch(/data: \{ status: "visible", hiddenBy: null \}/);
  });
});

describe("recovering from the AI does not undo human moderation", () => {
  it("has a scope that targets only the filter", () => {
    // `restore_all` was the ONLY bulk recovery, and had to be, because nothing
    // could tell the two apart. That made the fix for a bad classification
    // "un-hide every moderated message in the room".
    expect(mod).toMatch(/action === "restore_ai"\s*\? \{ status: "hidden", hiddenBy: "ai" \}/);
    expect(mod).toMatch(/z\.enum\(\["hide", "restore", "restore_all", "restore_ai", "pin", "unpin"\]\)/);
  });

  it("keeps restore_all, because sometimes you do mean all of it", () => {
    expect(mod).toMatch(/: \{ status: "hidden", OR: \[\{ hiddenBy: null \}, \{ hiddenBy: \{ not: "author" \} \}\] \}/);
  });

  it("but never brings back a message its own author deleted", () => {
    expect(read("src/app/api/chat/messages/[id]/route.ts")).toMatch(/hiddenBy: msg\.userId === me\.id \? "author" : me\.id/);
    expect(mod).toMatch(/if \(action === "restore" && msg\.hiddenBy === "author"\) return fail\("The author deleted this message\.", 409\);/);
  });

  it("the dashboard offers the safe one first and says which is which", () => {
    expect(dash).toMatch(/Restore AI-hidden \(\$\{aiHiddenCount\}\)/);
    expect(dash).toMatch(/Restore all hidden \(\$\{hiddenCount\}\)/);
    // The destructive-sounding one warns that it includes staff decisions.
    expect(dash).toMatch(/including ones staff hid deliberately/);
  });

  it("labels each hidden row with who hid it", () => {
    expect(dash).toMatch(/m\.hiddenBy === "ai" \? "AI filter" : m\.hiddenBy \? "By staff" : "Unknown"/);
  });

  it("the moderation feed actually returns the attribution", () => {
    // A column nothing reads is the same blindness in a different place.
    expect(mod).toMatch(/select: \{ \.\.\.CHAT_MESSAGE_SELECT, status: true, hiddenBy: true \}/);
    expect(mod).toMatch(/status: m\.status, hiddenBy: m\.hiddenBy/);
  });
});

describe("two presence writers stop fighting over one row", () => {
  it("the site heartbeat no longer stamps its room over the chat's", () => {
    // `ChatPresence.userId` is the primary key, so one member is one row however
    // many tabs are open. `chatOwnsPresence` stops this heartbeat running on
    // /community - but it only sees its OWN tab's pathname. With /community in
    // one tab and any other page in a second, both writers reached the same row
    // and this one overwrote `room: "community"` with `room: "site"`, dropping
    // the member from the chat's count until their next 25s beat.
    expect(sitePresence).toMatch(/update: \{ seenAt: new Date\(\) \}/);
    expect(sitePresence).not.toMatch(/update: \{ room: ROOM_SITE, seenAt: new Date\(\) \}/);
  });

  it("still sets the room when it creates the row", () => {
    expect(sitePresence).toMatch(/create: \{ userId: me\.id, room: ROOM_SITE, seenAt: new Date\(\) \}/);
  });

  it("loses nothing, because the site count is room-agnostic", () => {
    // If the site tile filtered by room, not writing it would break that tile
    // instead - so this is the assertion that makes the fix safe.
    expect(sitePresence).toMatch(/\.count\(\{ where: \{ seenAt: \{ gte: since \} \} \}\)/);
  });
});
