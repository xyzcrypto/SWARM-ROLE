import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Three DM bugs that all show up as "the app is lying to me about my messages".
//
// Real source paths on purpose: `src/components/*` and `src/lib/*` are
// re-export shims after #203, so reading one matches nothing and passes while
// verifying nothing.
const inbox = readFileSync("src/app/api/dm/route.ts", "utf8");
const unread = readFileSync("src/app/api/dm/unread/route.ts", "utf8");
const client = readFileSync("src/modules/messages/components/MessagesClient.tsx", "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const I = strip(inbox);
const U = strip(unread);
const C = strip(client);

describe("the navbar badge counts what the inbox shows", () => {
  it("excludes hidden conversations, like the inbox does", () => {
    // The badge queried `{ OR: [{ userAId: me.id }, { userBId: me.id }] }` with
    // no hidden filter, so it counted conversations the inbox refuses to list.
    // Hide a conversation that still has an unread message and you get a badge
    // in the navbar with no thread behind it to open and clear it.
    expect(U).toMatch(/userAId: me\.id, hiddenByA: false/);
    expect(U).toMatch(/userBId: me\.id, hiddenByB: false/);
    expect(U).not.toMatch(/where: \{ OR: \[\{ userAId: me\.id \}, \{ userBId: me\.id \}\] \}/);
  });

  it("uses the same shape the inbox uses", () => {
    // If these two ever disagree again the symptom is the same, so pin that
    // they are written the same way rather than just that both compile.
    for (const src of [I, U]) {
      expect(src).toMatch(/userAId: me\.id, hiddenByA: false/);
      expect(src).toMatch(/userBId: me\.id, hiddenByB: false/);
    }
  });
});

describe("a pinned conversation cannot be crowded out", () => {
  it("fetches pinned rows on their own", () => {
    // It was one `take: 50` ordered by time, with pinned floated to the top in
    // JS AFTERWARDS - so the sort could only reorder what the window had already
    // selected. A pinned conversation that went quiet fell past 50 by time and
    // vanished. Pinning a conversation you rarely use is what pinning is FOR,
    // so the feature failed hardest at its own purpose.
    expect(I).toMatch(/pinnedByA: true/);
    expect(I).toMatch(/pinnedByB: true/);
    expect(I).toMatch(/const \[pinnedRows, recentRows\] = await Promise\.all\(\[/);
  });

  it("de-dupes the two result sets", () => {
    // A pinned conversation that is also recent is in both.
    expect(I).toMatch(/const byId = new Map<string, any>\(\)/);
    expect(I).toMatch(/for \(const c of \[\.\.\.pinnedRows, \.\.\.recentRows\]\) byId\.set\(c\.id, c\)/);
  });

  it("sorts by time within each group, not just by pinned", () => {
    // The old comparator returned 0 for two rows of the same pinned state and
    // leaned on the query having ordered them. That stopped holding the moment
    // two queries were merged, which would have left the inbox arbitrary for
    // anyone with a pin.
    expect(I).toMatch(/if \(a\.pinned !== b\.pinned\) return a\.pinned \? -1 : 1;/);
    expect(I).toMatch(/new Date\(b\.lastMessageAt\)\.getTime\(\) - new Date\(a\.lastMessageAt\)\.getTime\(\)/);
  });

  it("still caps the pinned query", () => {
    // Pinning is user-driven and nothing else bounds it.
    expect(I).toMatch(/pinnedByA: true[\s\S]{0,320}take: 50/);
  });
});

describe("starting a conversation says why it failed", () => {
  it("no longer swallows the error", () => {
    // Was `r.ok ? await r.json() : null` plus `catch { /* ignore */ }`, so
    // tapping "Message" on someone who does not accept DMs simply did nothing.
    expect(C).toMatch(/setStartErr\(j\?\.error \?\? "Couldn't start that conversation\."\)/);
    expect(C).not.toMatch(/const j = r\.ok \? await r\.json\(\) : null;/);
  });

  it("clears the previous error when trying again", () => {
    expect(C).toMatch(/setStarting\(true\);\s*setStartErr\(null\);/);
  });

  it("renders it", () => {
    // A state nobody displays is the same silence in a different place.
    expect(C).toMatch(/\{startErr && <p[^>]*>\{startErr\}<\/p>\}/);
  });

  it("has its own state, separate from the thread's", () => {
    // The Thread component has its own `err`; this is the inbox side, which had
    // no way to say anything at all.
    expect(C).toMatch(/const \[startErr, setStartErr\] = useState<string \| null>\(null\)/);
  });
});

describe("sending says why it failed too", () => {
  it("does not swallow the send error either", () => {
    // Found by the assertion above, not by looking: `doSend` had the same
    // `r.ok ? await r.json() : null` shape. Its ROLLBACK was already correct -
    // the optimistic message is removed and the draft restored - but a send
    // blocked by the recipient, by a DM privacy change since the thread was
    // opened, or by the rate limit all looked identical: the message vanishes
    // and nothing says why. The server has words for each of them.
    expect(C).toMatch(/setErr\(j\?\.error \?\? "Couldn't send that message\."\)/);
    expect(C).not.toMatch(/const j = r\.ok \? await r\.json\(\) : null;/);
  });

  it("keeps the rollback that was already right", () => {
    expect(C).toMatch(/setMessages\(\(m\) => m\.filter\(\(x\) => x\.id !== tempId\)\)/);
    expect(C).toMatch(/if \(fromDraft\) setDraft\(\(d\) => \(d\.trim\(\) \? d : body\)\)/);
  });
});
