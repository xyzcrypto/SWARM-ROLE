import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DM_REACTIONS, isDmReaction, toDmReactions } from "@modules/messages/lib/dm-reactions";
import { BOTTOM_HIDDEN_PREFIXES } from "@/lib/bottom-nav";

/**
 * The chat + DM overhaul: immersive screens, DM reactions, and the two DM
 * bugs the owner reported. Each fix was confirmed in a real browser against
 * the real components; these pin the code-level reason each one works.
 */

const read = (f: string) => readFileSync(f, "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");

const DM_UI = read("src/modules/messages/components/MessagesClient.tsx");
const ROOM = read("src/modules/community/components/ChatClient.tsx");
const THREAD_API = strip(read("src/app/api/dm/[id]/route.ts"));
const REACT_API = strip(read("src/app/api/dm/[id]/message/[messageId]/react/route.ts"));

describe("'tag karne pe direct tag nahi ho raha' - a reply keeps its quote", () => {
  it("the send response carries the quote and the forwarded flag", () => {
    // The client swaps its optimistic row for this object. Without `replyTo`
    // the quote vanished the moment the server answered.
    expect(THREAD_API).toMatch(/replyTo: \{ select: \{ id: true, body: true, senderId: true, status: true \} \},\s*\},\s*\}\);/);
    expect(THREAD_API).toMatch(/forwarded: created\.forwarded,\s*replyTo: created\.replyTo/);
  });
});

describe("'click karne pe redirect nahi hota' - tapping a quote goes to it", () => {
  it("the quote is a button that jumps", () => {
    expect(DM_UI).toMatch(/aria-label="Go to the quoted message"/);
    expect(DM_UI).toMatch(/jumpTo\(m\.replyTo!\.id\)/);
  });

  it("scrolls the list, never the page", () => {
    // `scrollIntoView` walks every scrollable ancestor - the room already
    // learned that it can move the page itself.
    const jump = /const jumpTo = [\s\S]*?\n  \};/.exec(strip(DM_UI))?.[0] ?? "";
    expect(jump).not.toBe("");
    expect(jump).not.toMatch(/scrollIntoView/);
    expect(jump).toMatch(/list\.scrollTo\(/);
    expect(jump).toMatch(/classList\.add\("msg-flash"\)/);
  });
});

describe("'block wala hide ho raha hai' - the conversation menu is on top", () => {
  it("the thread header outranks the message list", () => {
    // Both were `z-[1]`, and the list came later in the document, so the
    // Block / Report menu opened UNDER the bubbles.
    expect(DM_UI).toMatch(/<header className=\{cn\("relative z-20 flex items-center/);
    expect(DM_UI).not.toMatch(/<header className="relative z-\[1\] flex items-center gap-3/);
  });

  it("blocking asks first, and the blocked state is spelled out", () => {
    expect(DM_UI).toMatch(/setConfirmBlock\(true\)/);
    expect(DM_UI).toMatch(/role="alertdialog"/);
    expect(DM_UI).toMatch(/You blocked \$\{otherName\}/);
  });

  it("Escape closes the menu", () => {
    expect(DM_UI).toMatch(/if \(!threadMenu\) return;[\s\S]{0,120}e\.key === "Escape"/);
  });

  it("inbox rows do not reuse the thread's accessible name", () => {
    expect(DM_UI).toMatch(/aria-label=\{`Options for \$\{c\.other\?\.name \?\? "this conversation"\}`\}/);
  });
});

describe("DM reactions", () => {
  it("a fixed set, validated both ways", () => {
    expect(DM_REACTIONS).toHaveLength(6);
    expect(isDmReaction("❤️")).toBe(true);
    expect(isDmReaction("<script>")).toBe(false);
    expect(isDmReaction(null)).toBe(false);
  });

  it("maps A/B to mine/theirs for whoever is asking", () => {
    const row = { reactionA: "❤️", reactionB: "🔥" };
    expect(toDmReactions(row, true)).toEqual({ mine: "❤️", theirs: "🔥" });
    expect(toDmReactions(row, false)).toEqual({ mine: "🔥", theirs: "❤️" });
    // Anything not in the set - an old value, a hand-edited row - drops.
    expect(toDmReactions({ reactionA: "lol", reactionB: null }, true)).toEqual({ mine: null, theirs: null });
  });

  it("the thread reads them in a separate query that is allowed to fail", () => {
    // Preview deploys share the production database but never push the
    // schema - selecting the new columns in the main query would 503 every
    // DM thread on a preview until the next production deploy.
    expect(THREAD_API).toMatch(/select: \{ id: true, reactionA: true, reactionB: true \},\s*\}\)\s*\.catch\(\(\) => \[\]\)/);
    const mainSelect = /prisma\.directMessage\.findMany\(\{\s*where: \{ conversationId: conv\.id, \.\.\.notHiddenForMe \}[\s\S]*?\}\),/.exec(THREAD_API)?.[0] ?? "";
    expect(mainSelect).not.toBe("");
    expect(mainSelect).not.toMatch(/reactionA|reactionB/);
  });

  it("the route: allowlisted emoji, block-gated, authorised from the message, two limiters", () => {
    expect(REACT_API).toMatch(/z\.string\(\)\.refine\(isDmReaction/);
    expect(REACT_API).toMatch(/canSendInThread\(me\.id, otherId\)/);
    expect(REACT_API).toMatch(/msg\.conversationId !== params\.id/);
    expect([...REACT_API.matchAll(/if \(!success\) return/g)]).toHaveLength(2);
    expect(REACT_API).toMatch(/react-ip-\$\{clientIp\(req\)\}/);
    // No content on the public realtime channel.
    expect(REACT_API).toMatch(/broadcastEvent\(userChannel\(otherId\), "dm_message", \{ conversationId: msg\.conversationId \}\)/);
  });

  it("schema + an idempotent migration", () => {
    const schema = read("prisma/schema.prisma");
    expect(schema).toMatch(/reactionA String\?/);
    expect(schema).toMatch(/reactionB String\?/);
    const sql = read("prisma/migrations/41_dm_reactions/migration.sql");
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "reactionA" TEXT/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "reactionB" TEXT/);
  });

  it("a reaction change is not skipped by the silent-refetch shortcut", () => {
    expect(DM_UI).toMatch(/\(x\.reactions\?\.theirs \?\? null\) !== \(y\.reactions\?\.theirs \?\? null\)/);
  });
});

describe("gestures", () => {
  const swipe = strip(read("src/modules/community/components/SwipeBubble.tsx"));
  it("decides from a ref, not from render state", () => {
    // A probe caught a full swipe doing nothing: the pointer-up handler read
    // `dx` from a render that had not happened yet.
    expect(swipe).toMatch(/const replied = armed\.current && drag\.current >= REPLY_AT;/);
    expect(swipe).not.toMatch(/armed\.current && dx >= REPLY_AT/);
  });
  it("leaves vertical scrolling to the browser", () => {
    expect(swipe).toMatch(/touch-pan-y/);
  });
  it("both chat surfaces use it", () => {
    expect(DM_UI).toMatch(/<SwipeBubble/);
    expect(ROOM).toMatch(/<SwipeBubble/);
  });
});

describe("drafts never touch the first render", () => {
  it("reads localStorage in an effect, deferred", () => {
    // The composer is server-rendered for a `?c=` link; localStorage during
    // render would be a hydration mismatch (#418).
    const composer = strip(DM_UI).slice(strip(DM_UI).indexOf("function DmComposer("));
    expect(composer).toMatch(/void Promise\.resolve\(\)\.then\(\(\) => \{[\s\S]{0,200}localStorage\.getItem\(DRAFT_KEY\(draftKey\)\)/);
    expect(composer).not.toMatch(/useState\(\(\) => [^)]*localStorage/);
  });
});

describe("an empty composer is one line", () => {
  it("in the shared hook and in the room", () => {
    // The placeholder wrapped on a phone and sized the empty box to two lines.
    expect(read("src/shared/hooks/useAutoGrow.ts")).toMatch(/if \(!el\.value\) \{\s*el\.style\.height = "";/);
    expect(ROOM).toMatch(/if \(!el\.value\) \{\s*el\.style\.height = "";/);
  });

  it("attachments sit behind one + button", () => {
    expect(ROOM).toMatch(/<AttachTray/);
    expect(DM_UI).toMatch(/<AttachTray/);
    expect(ROOM).not.toMatch(/aria-label="Create a poll"/);
  });

  it("the room's character count only appears near the limit", () => {
    expect(ROOM).toMatch(/body\.length > MAX_LENGTH - 100/);
  });
});

describe("immersive chat screens", () => {
  const dmPage = read("src/app/messages/page.tsx");
  const roomPage = read("src/app/community/page.tsx");

  it("no site header on /messages, or in the member view of /community", () => {
    expect(dmPage).not.toMatch(/<Navbar/);
    const member = roomPage.slice(roomPage.lastIndexOf("  return ("));
    expect(member).not.toMatch(/<Navbar/);
    expect(member).toMatch(/h-\[100dvh\]/);
    // The signed-out preview is a landing page and keeps the site chrome.
    expect(roomPage.slice(0, roomPage.lastIndexOf("  return ("))).toMatch(/<Navbar \/>/);
  });

  it("the room lost its title and LIVE label, not its connection state", () => {
    expect(ROOM).not.toMatch(/>XYZ Lounge</);
    expect(ROOM).toMatch(/\{pollError \? "Stale" : live \? "Live" : "Synced"\}/);
  });

  it("the whole site navigation is behind the menu button", () => {
    const menu = read("src/shared/components/AppMenu.tsx");
    expect(menu).toMatch(/navLinks\.filter\(\(l\) => l\.href !== "\/community"\)\.map/);
    expect(menu).toMatch(/row\("\/community", "Community", Users\)/);
    expect(DM_UI).toMatch(/<AppMenu \/>/);
    expect(ROOM).toMatch(/<AppMenu \/>/);
  });

  it("nothing floats over the composer", () => {
    expect(BOTTOM_HIDDEN_PREFIXES).toEqual(expect.arrayContaining(["/community", "/messages"]));
    const ai = read("src/modules/ai/components/XyzAiWidget.tsx");
    expect(ai).toMatch(/pathname\?\.startsWith\("\/community"\)[\s\S]{0,80}pathname\?\.startsWith\("\/messages"\)/);
    expect(ai).toMatch(/immersive && "hidden"/);
  });
});

describe("no silently-dropped colours in the chat surfaces", () => {
  // `bg-ink-900/98` generated NO rule - Tailwind's opacity scale is in steps of
  // 5 - so the conversation menu and the GIF picker had no background at all.
  // A screenshot caught it; no assertion did.
  const files = [
    "src/modules/messages/components/MessagesClient.tsx",
    "src/modules/community/components/ChatClient.tsx",
    "src/modules/community/components/AttachTray.tsx",
    "src/modules/community/components/SwipeBubble.tsx",
    "src/modules/community/components/GifPicker.tsx",
    "src/modules/community/lib/chat-ui.ts",
    "src/shared/components/AppMenu.tsx",
  ];
  for (const f of files) {
    it(f, () => {
      const bad = [...read(f).matchAll(/\b(?:bg|text|border|ring|from|via|to|shadow)-[a-z]+(?:-\d{2,3})?\/(\d+)\b/g)]
        .filter((m) => Number(m[1]) % 5 !== 0)
        .map((m) => m[0]);
      expect(bad, `${f}: ${bad.join(", ")}`).toEqual([]);
    });
  }
});
