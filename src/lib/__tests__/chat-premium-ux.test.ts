import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  CHAT_BACKGROUNDS,
  CHAT_BG_KEY,
  chatBackgroundById,
  isChatBackgroundId,
} from "@modules/community/lib/chat-backgrounds";

/**
 * ⚠️ These are source-level assertions ON PURPOSE, and it is worth saying why
 * rather than leaving it to look like laziness.
 *
 * `/community` needs Postgres and a session: signed out it renders a separate
 * `CommunityPreview`, and this environment has neither `DATABASE_URL` nor
 * `NEXTAUTH_SECRET`. A browser probe against it here loads an empty shell, so
 * every assertion in one would pass while measuring nothing - which is the
 * failure shape this repo has been bitten by repeatedly.
 *
 * So the behaviour that CAN only be confirmed in a browser is listed in the PR
 * as manual steps against the Vercel preview, and what is pinned here is the
 * code-level invariant behind each fix.
 */

const CHAT = "src/modules/community/components/ChatClient.tsx";
const REPORT_ROUTE = "src/app/api/chat/messages/[id]/report/route.ts";
const DIALOG = "src/modules/community/components/ReportDialog.tsx";

const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");

const chat = strip(readFileSync(CHAT, "utf8"));
const route = strip(readFileSync(REPORT_ROUTE, "utf8"));
const dialog = strip(readFileSync(DIALOG, "utf8"));

describe("the composer grows with what you type", () => {
  it("measures with the height released first", () => {
    // ⚠️ THE BUG. The textarea was `rows={1}` + `resize-none` + `min-h-[44px]`
    // and NOTHING adjusted its height, so a long message scrolled inside a
    // single 44px line. `max-h-28` was present, but a box that never grows
    // never reaches its maximum.
    //
    // `height = "auto"` before reading `scrollHeight` is the load-bearing line:
    // the scrollHeight of an element with a fixed height IS that height, so
    // measuring without resetting reads back what you already set and the box
    // never grows a second time.
    expect(chat).toMatch(/el\.style\.height = "auto";/);
    expect(chat).toMatch(/Math\.min\(el\.scrollHeight, COMPOSER_MAX_H\)/);
  });

  it("caps its height and scrolls internally past the cap", () => {
    // Uncapped, a long message would push the message list off a small screen -
    // the brief's "composer must not cover the latest messages".
    expect(chat).toMatch(/const COMPOSER_MAX_H = \d+;/);
    expect(chat).toMatch(/el\.style\.overflowY = el\.scrollHeight > COMPOSER_MAX_H \? "auto" : "hidden";/);
  });

  it("no longer carries a CSS max-height that would fight the inline one", () => {
    // A `max-h-*` and an inline `height` on the same element is how a control
    // like this ends up stuck at one size.
    expect(chat).not.toMatch(/max-h-28[^"]*w-full resize-none/);
  });

  it("re-measures when the placeholder or the width changes, not only on typing", () => {
    // ⚠️ A probe caught the EMPTY composer at 76px on a phone: measured once
    // against the server snapshot's longer desktop placeholder, never again
    // until the member typed. The placeholder feeds scrollHeight.
    expect(chat).toMatch(/\[body, touchUi, measureComposer\]/);
    expect(chat).toMatch(/new ResizeObserver\(/);
    expect(chat).toMatch(/el\.clientWidth !== lastWidth/);
  });

  it("keeps the existing Enter / Shift+Enter convention", () => {
    // Not a place to innovate: touch keyboards have no Shift, so Enter inserts
    // a newline there and the send button submits. Desktop keeps Enter-to-send.
    expect(chat).toMatch(/e\.key === "Enter" && !e\.shiftKey && !touchUi/);
  });
});

describe("reporting a message tells the reporter nothing about moderation", () => {
  it("requires a session and rate-limits on two independent keys", () => {
    // Per-user alone is defeated by registering accounts; per-IP alone punishes
    // shared NAT. Both is the pattern this codebase uses for abusable routes.
    expect(route).toMatch(/getSessionUser\(\)/);
    expect(route).toMatch(/report-\$\{me\.id\}/);
    expect(route).toMatch(/report-ip-\$\{clientIp\(req\)\}/);
    // The canonical shape, so `api-rate-limits.test.ts` can see it.
    expect([...route.matchAll(/if \(!success\) return/g)]).toHaveLength(2);
  });

  it("only lets you report a message you can actually see", () => {
    // ⚠️ `status: "visible"` is part of the WHERE, not a branch afterwards -
    // which is also what stops the route being used to enumerate hidden or
    // deleted message ids.
    expect(route).toMatch(/findFirst\(\{\s*where: \{ id, status: "visible" \}/);
    expect(route).toMatch(/isCuid\(id\)/);
  });

  it("refuses self-reports", () => {
    expect(route).toMatch(/message\.userId === me\.id/);
  });

  it("answers a duplicate exactly as it answers a first report", () => {
    // ⚠️ Saying "you already reported this" would confirm a prior report
    // exists, which is moderation state. The unique index does the
    // de-duplication; the P2002 branch swallows it and falls through to the
    // same success.
    expect(route).toMatch(/code !== "P2002"/);
    expect([...route.matchAll(/ok\(\{ received: true \}\)/g)]).toHaveLength(1);
  });

  it("never returns moderation state, counts or staff identities", () => {
    for (const leak of ["hiddenBy", "moderator", "reportCount", "reports:", "status: report"]) {
      expect(route, `must not expose ${leak}`).not.toMatch(new RegExp(leak));
    }
  });

  it("does not hide anything - reporting is a signal, not an action", () => {
    // A self-service hide would let any member silence any other.
    expect(route).not.toMatch(/chatMessage\.update/);
    expect(dialog).toMatch(/does not remove the message/i);
  });

  it("the dialog is a real, labelled, escapable dialog", () => {
    expect(dialog).toMatch(/role="dialog"/);
    expect(dialog).toMatch(/aria-modal="true"/);
    expect(dialog).toMatch(/aria-labelledby="report-title"/);
    expect(dialog).toMatch(/e\.key === "Escape"/);
    expect(dialog).toMatch(/role="radiogroup"/);
    // Portalled: the chat shell is overflow-hidden, and a fixed child of an
    // overflow-hidden ancestor is still clipped by it.
    expect(dialog).toMatch(/createPortal\(/);
  });
});

describe("chat backgrounds are cheap and readable", () => {
  it("offers a curated set in two families", () => {
    // Curated, not endless: eleven is enough to find one you like and few
    // enough to scan on a phone. Two families so the grid reads as a choice
    // between kinds of thing, not a wall of swatches.
    expect(CHAT_BACKGROUNDS).toHaveLength(11);
    expect(CHAT_BACKGROUNDS[0]!.id).toBe("default");
    const cats = new Set(CHAT_BACKGROUNDS.map((b) => b.category));
    expect([...cats].sort()).toEqual(["colour", "pattern"]);
    // Every id is unique, or a stored choice could resolve to the wrong one.
    expect(new Set(CHAT_BACKGROUNDS.map((b) => b.id)).size).toBe(CHAT_BACKGROUNDS.length);
  });

  it("is CSS only - no asset, no fetch, no canvas", () => {
    // ⚠️ Comments stripped first. This file EXPLAINS why it uses no video,
    // canvas or SVG - so a raw scan flags its own reasoning, which is how a
    // check ends up firing on the warning about a problem rather than the
    // problem. Same trap as `design-tokens-exist.test.ts`.
    const lib = strip(readFileSync("src/modules/community/lib/chat-backgrounds.ts", "utf8"));
    expect(lib).not.toMatch(/\.png|\.jpg|\.jpeg|\.webp|\.svg|url\(|<canvas|video/i);
    for (const bg of CHAT_BACKGROUNDS) {
      if (!bg.dark) continue;
      expect(bg.dark, `${bg.id} dark`).toMatch(/gradient\(/);
    }
  });

  it("carries BOTH themes for every preset", () => {
    // ⚠️ A wash tuned for near-black is either invisible or filthy on a light
    // page - the same mistake the app's white hover tints made.
    for (const bg of CHAT_BACKGROUNDS) {
      expect(typeof bg.dark, `${bg.id}`).toBe("string");
      expect(typeof bg.light, `${bg.id}`).toBe("string");
      // Either both empty (the default) or both set.
      expect(Boolean(bg.dark), `${bg.id} must define both or neither`).toBe(Boolean(bg.light));
    }
  });

  it("stays quiet enough to read a conversation on", () => {
    // Every alpha under 0.2. A background that is interesting to look at is a
    // background you cannot read a conversation on.
    for (const bg of CHAT_BACKGROUNDS) {
      for (const src of [bg.dark, bg.light]) {
        for (const m of src.matchAll(/rgba\([^)]*?,\s*([\d.]+)\)/g)) {
          const alpha = Number(m[1]);
          if (alpha === 0) continue;
          expect(alpha, `${bg.id} alpha ${alpha} is too strong`).toBeLessThanOrEqual(0.2);
        }
      }
    }
  });

  it("never animates - it sits behind a scrolling list", () => {
    const lib = strip(readFileSync("src/modules/community/lib/chat-backgrounds.ts", "utf8"));
    expect(lib).not.toMatch(/animation|@keyframes/);
  });

  it("validates what it reads back from storage", () => {
    expect(isChatBackgroundId("grid")).toBe(true);
    expect(isChatBackgroundId("../../etc")).toBe(false);
    expect(isChatBackgroundId(null)).toBe(false);
    // An unknown id falls back rather than rendering nothing.
    expect(chatBackgroundById("nope" as never).id).toBe("default");
    expect(CHAT_BG_KEY).toBe("xyz.chat.bg");
  });
});

describe("touch targets and the room's existing behaviour", () => {
  it("gives message actions a 44px target on touch", () => {
    // The whole action row was `p-1.5` around a 14px icon - a ~26px target,
    // sitting next to Delete on some rows.
    expect(chat).toMatch(/touchUi \? "grid h-11 w-11 place-items-center" : "p-1\.5"/);
  });

  it("still does not yank a reader back to the bottom", () => {
    // Pre-existing and deliberately untouched: `stickToBottom` is set from
    // proximity, and the unread pill is what a scrolled-away reader gets.
    expect(chat).toMatch(/const nearBottom = el\.scrollHeight - el\.scrollTop - el\.clientHeight < 80;/);
    expect(chat).toMatch(/setStickToBottom\(nearBottom\)/);
  });

  it("still preserves typed text when a send fails", () => {
    // Pre-existing rollback. Pinned because the composer work touched the same
    // component and this is the behaviour most easily broken by accident.
    expect(chat).toMatch(/setBody\(\(b\) => \(b\.trim\(\) \? b : text\)\)/);
  });

  it("keeps the composer clear of the home indicator", () => {
    expect(chat).toMatch(/pb-\[max\(0\.5rem,env\(safe-area-inset-bottom\)\)\]/);
  });
});
