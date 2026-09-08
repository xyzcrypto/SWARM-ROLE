import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Community chat, the bug half - the same pass DM got in #309.
//
// The headline one is a rollback that destroyed data. `remove()` captured
// `const snapshot = messages` from the render closure at the moment of the
// click, so on a failed DELETE it restored the room to how it looked BEFORE
// the request - wiping every message that had arrived over realtime while the
// request was in flight. In a busy room a failed delete silently rewound the
// conversation, and nothing said so.
//
// Real source paths on purpose: `src/components/*` and `src/lib/*` are
// re-export shims after #203.
const chat = readFileSync("src/modules/community/components/ChatClient.tsx", "utf8");
const page = readFileSync("src/app/community/page.tsx", "utf8");
const strip = (s: string) => s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ");
const C = strip(chat);

describe("a failed delete does not rewind the room", () => {
  it("snapshots from the updater, not from the render closure", () => {
    expect(C).toMatch(/setMessages\(\(prev\) => \{\s*snapshot = prev;\s*return prev;\s*\}\)/);
    expect(C).not.toMatch(/const snapshot = messages;/);
  });

  it("still uses hideMessage rather than reimplementing it", () => {
    // `hideMessage` also blanks `body` and clears a pinned banner pointing at
    // the message. Inlining "set hidden: true" instead - which I did first -
    // quietly drops both.
    const fn = /async function remove\(id: string\) \{[\s\S]*?\n  \}/.exec(C)?.[0] ?? "";
    expect(fn).not.toBe("");
    expect(fn).toContain("hideMessage(id)");
  });

  it("restores the pinned banner too", () => {
    // Restoring only the list would leave a pin silently dropped, because
    // hideMessage clears it when it pointed at the removed message.
    expect(C).toMatch(/setPinned\(pinnedSnapshot\)/);
  });

  it("tells the reader when it fails", () => {
    // Every other mutation here (saveEdit, togglePin, vote, doSend) reports a
    // failure. This one put the message back and said nothing, so it read as
    // someone else having undone the delete.
    expect(C).toMatch(/setError\("Couldn't delete that message\."\)/);
  });
});

describe("your own message shows your own badge", () => {
  it("does not hardcode Free and a null handle", () => {
    // A Premium member's own message appeared without its badge and with an
    // unlinked avatar for the ~200ms until the server copy replaced it, then
    // both popped in. It is the one message on screen whose author the client
    // already knows.
    expect(C).not.toMatch(/username: null, image: null, membership: "Free"/);
    expect(C).toMatch(/username: me\.username \?\? null/);
    expect(C).toMatch(/membership: me\.membership \?\? "Free"/);
  });

  it("gets membership from the server, since the client cannot infer it", () => {
    expect(C).toMatch(/type Me = \{[^}]*membership\?: string/);
    expect(strip(page)).toMatch(/membership: \(me\.membership as string \| null\) \?\? "Free"/);
  });
});

describe("a translation failure says what actually happened", () => {
  it("keeps the server's reason instead of discarding it", () => {
    // The client replaced every failure with "Couldn't translate. Try again."
    // - advice that can never work when the real answer is a 503 "Translation
    // is not available right now" because AI is switched off. Retrying forever
    // was the only thing the old message left the reader to do.
    expect(C).toMatch(/error: j\?\.error \|\| undefined/);
    expect(C).toMatch(/translations\[m\.id\]\?\.error \?\? "Couldn't translate\. Try again\."/);
  });

  it("carries the reason in the translation state", () => {
    expect(C).toMatch(/translations, setTranslations\] = useState<Record<string, \{[^}]*error\?: string/);
  });
});
