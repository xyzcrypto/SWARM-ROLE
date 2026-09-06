import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { extractMentions, MAX_MENTIONS_PER_MESSAGE, MENTION_TOKEN_RE } from "@shared/utils/mentions";

// "message tag properly work nahi kar raha."
//
// Three separate gaps behind that:
//
// 1. **Being @mentioned notified nobody, anywhere.** The community room has
//    parsed, highlighted and autocompleted mentions since it was built, and
//    finding out you were tagged meant scrolling back through the room. The
//    `"new_message"` member of `NotificationType` had been declared since the
//    type was written and was constructed NOWHERE - every apparent hit for it
//    in the codebase is the realtime broadcast event of the same name, which is
//    a different thing entirely.
//
// 2. **DM had no mentions at all.** `<p className="whitespace-pre-wrap">{m.body}</p>`
//    - a raw string. `@alice` was grey text and a pasted link was not a link.
//
// 3. **The two rooms could never have agreed**, because each had (or lacked)
//    its own inline regex. One definition now, shared by the community
//    renderer, the DM renderer and the server that decides who to notify.

describe("extractMentions", () => {
  it("finds handles and lowercases them", () => {
    // Handles are stored lowercased (`normalizeUsername`), so `@Alice` and
    // `@alice` are the same person and must not notify twice.
    expect(extractMentions("hey @Alice and @bob")).toEqual(["alice", "bob"]);
  });

  it("de-dupes", () => {
    expect(extractMentions("@alice @alice @ALICE")).toEqual(["alice"]);
  });

  it("ignores an email address", () => {
    // `\b` would not do this - it treats `@` as a word boundary, so a `\b@\w+`
    // pattern happily matches the `alice` inside `me@alice.com`.
    expect(extractMentions("write to me@alice.com")).toEqual([]);
  });

  it("ignores a handle inside a url path", () => {
    expect(extractMentions("see https://x.com/@someone for more")).toEqual([]);
  });

  it("respects the handle length rules", () => {
    // 3-20 of [a-z0-9_], matching profile.ts.
    expect(extractMentions("@ab is too short")).toEqual([]);
    expect(extractMentions("@abc is fine")).toEqual(["abc"]);
    expect(extractMentions(`@${"a".repeat(21)}`)).toEqual([`${"a".repeat(20)}`]);
  });

  it("caps the fan-out", () => {
    // A message is a message, not a broadcast list: without a cap, one message
    // pasting fifty handles fans out to fifty notification rows and fifty
    // pushes, which is the shape of a spam tool.
    const many = Array.from({ length: 20 }, (_, i) => `@user${i}`).join(" ");
    expect(extractMentions(many)).toHaveLength(MAX_MENTIONS_PER_MESSAGE);
  });

  it("handles empty and mention-free text", () => {
    expect(extractMentions("")).toEqual([]);
    expect(extractMentions("no tags here")).toEqual([]);
  });

  it("is safe to call repeatedly despite the /g flag", () => {
    // A shared /g regex used with `.test()` carries a mutable `lastIndex` and
    // fails every other call. `matchAll` does not have that problem, and this
    // pins that the implementation keeps using it.
    for (let i = 0; i < 5; i++) expect(extractMentions("@alice")).toEqual(["alice"]);
  });

  it("the token pattern matches what the extractor finds", () => {
    // The renderer splits text and tests each piece with MENTION_TOKEN_RE; the
    // server extracts with MENTION_RE. If those two disagree, a mention gets
    // highlighted and notifies nobody, or vice versa.
    for (const h of extractMentions("hi @alice and @bob_2")) {
      expect(MENTION_TOKEN_RE.test(`@${h}`)).toBe(true);
    }
  });
});

describe("mentions notify, on both surfaces", () => {
  const notifications = readFileSync("src/modules/notifications/lib/notifications.ts", "utf8");
  const chat = readFileSync("src/app/api/chat/messages/route.ts", "utf8");
  const dm = readFileSync("src/app/api/dm/[id]/route.ts", "utf8");
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

  it("has a real notification type, not the dead one", () => {
    expect(strip(notifications)).toMatch(/NotificationType = [^;]*"mention"/);
    expect(strip(notifications)).toMatch(/type: "mention" as const/);
  });

  it("resolves handles against real users", () => {
    // So `@notauser` notifies nobody, rather than failing silently deeper down.
    expect(strip(notifications)).toMatch(/prisma\.user\.findMany\(\{\s*where: \{ username: \{ in: handles \} \}/);
  });

  it("never notifies the author about their own message", () => {
    expect(strip(notifications)).toMatch(/\.filter\(\(id\) => id !== input\.authorId\)/);
  });

  it("cannot leak a private thread to a third party", () => {
    // A DM has exactly two participants. Without this, `@someone_else` in a
    // private thread would tell that person they were mentioned somewhere they
    // cannot open - which discloses that the conversation exists.
    expect(strip(notifications)).toMatch(/restrictToUserIds/);
    expect(strip(dm)).toMatch(/restrictToUserIds: \[recipientId\]/);
  });

  it("is wired into both send paths, fire-and-forget", () => {
    // Same rule as every other side effect on these paths: a mention that fails
    // to notify must never take the message with it.
    expect(strip(chat)).toMatch(/void notifyMentions\(\{/);
    expect(strip(dm)).toMatch(/void notifyMentions\(\{/);
  });

  it("never throws", () => {
    expect(strip(notifications)).toMatch(/notifyMentions[\s\S]*?catch \(err\) \{[\s\S]{0,120}console\.error/);
  });
});

describe("both rooms render mentions the same way", () => {
  const shared = readFileSync("src/shared/components/MessageText.tsx", "utf8");
  const chatUi = readFileSync("src/modules/community/components/ChatClient.tsx", "utf8");
  const dmUi = readFileSync("src/modules/messages/components/MessagesClient.tsx", "utf8");

  it("DM renders mentions and links at all", () => {
    // It used to be `<p className="whitespace-pre-wrap break-words">{m.body}</p>`.
    expect(dmUi).toContain("<MessageText");
    expect(dmUi).not.toMatch(/<p className="whitespace-pre-wrap break-words">\{m\.body\}<\/p>/);
  });

  it("the community room uses the same component, not its own copy", () => {
    expect(chatUi).toContain("<MessageText");
    // The inline regex literal that made the two drift in the first place.
    expect(chatUi).not.toMatch(/text\.split\(\/\(https\?:/);
  });

  it("the renderer and the server share one definition", () => {
    expect(shared).toContain("@shared/utils/mentions");
    expect(readFileSync("src/modules/notifications/lib/notifications.ts", "utf8")).toContain("@shared/utils/mentions");
  });

  it("still refuses an unsafe url", () => {
    expect(shared).toContain("safeHref(url)");
  });
});
