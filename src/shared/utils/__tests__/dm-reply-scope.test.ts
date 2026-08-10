import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// The sharp edge of DM replies. Community chat is one global room, so quoting
// any message is fine there. DMs are private and there are many threads, so a
// reply target accepted on its id ALONE would let someone quote a message out
// of a conversation they are not part of - and the quoted preview would then
// render that private text to the other participant.
//
// No DB in this project's vitest setup, so the guard is pinned structurally:
// this proves the conversation scope is in the query, not that a cross-thread
// id is rejected at runtime.
const route = readFileSync("src/app/api/dm/[id]/route.ts", "utf8");

describe("a DM reply target must belong to the same conversation", () => {
  // Anchored on `parsed.data.replyToId` rather than the first findFirst in the
  // file - there is an earlier one for the pinned banner, and matching that
  // would have made this pass or fail for entirely the wrong reason.
  const lookup = route.match(/where:\s*\{[^}]*parsed\.data\.replyToId[^}]*\}/)?.[0] ?? "";

  it("scopes the parent lookup by conversationId, not by id alone", () => {
    expect(lookup).toMatch(/id: parsed\.data\.replyToId/);
    expect(lookup).toMatch(/conversationId: conv\.id/);
  });

  it("only quotes a visible parent", () => {
    expect(lookup).toMatch(/status: "visible"/);
  });

  // A stale or foreign id sends as a normal message rather than failing the
  // send - losing the quote is better than losing the message.
  it("drops an unmatched target instead of rejecting the send", () => {
    expect(route).toMatch(/replyToId = parent\?\.id \?\? null/);
  });
});

describe("forwarding must not link to the original", () => {
  // A reference would point into a conversation the recipient has no right to
  // read, and resolving it for a preview would leak that thread.
  it("is stored as a boolean flag", () => {
    expect(route).toMatch(/forwarded: parsed\.data\.forwarded === true/);
  });

  it("has no forwardedFrom relation in the schema", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const dm = schema.match(/model DirectMessage \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(dm).toMatch(/forwarded\s+Boolean/);
    expect(dm).not.toMatch(/forwardedFrom\w*\s+\w*Message/);
  });
});
