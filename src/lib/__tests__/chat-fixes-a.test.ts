import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { centredScrollTop } from "@shared/utils/scroll-into-list";

const read = (f: string) => readFileSync(f, "utf8");

describe("jumping to a quoted message lands on THAT message", () => {
  // list: 600px tall, scrolled to 5000; target is 250px below the list's top
  // edge on screen. Its true offset in the list content is therefore 5250.
  const list = { scrollTop: 5000, clientHeight: 600, getBoundingClientRect: () => ({ top: 100 }) };
  const el = { getBoundingClientRect: () => ({ top: 350, height: 40 }) };

  it("centres by rects, whatever wrappers sit in between", () => {
    // 5250 - 300 + 20 = 4970
    expect(centredScrollTop(list, el)).toBe(4970);
  });

  it("never scrolls above the top", () => {
    expect(centredScrollTop({ ...list, scrollTop: 0 }, { getBoundingClientRect: () => ({ top: 120, height: 40 }) })).toBe(0);
  });

  it("neither chat surface measures with offsetTop any more", () => {
    // offsetTop is relative to the nearest POSITIONED ancestor; the swipe
    // wrapper made that ~0 for every row, so the room jumped ~2000px wrong.
    for (const f of ["src/modules/community/components/ChatClient.tsx", "src/modules/messages/components/MessagesClient.tsx"]) {
      const s = read(f);
      expect(s, f).not.toMatch(/\.offsetTop/);
      expect(s, f).toMatch(/centredScrollTop\(list, /);
    }
  });
});

describe("voice notes are allowed to load", () => {
  it("the CSP lets <audio> fetch from Supabase Storage", () => {
    // media-src was 'self' blob: - the browser refused every voice note
    // before a byte was requested.
    const cfg = read("next.config.mjs");
    expect(cfg).toMatch(/"media-src 'self' blob: https:\/\/\*\.supabase\.co"/);
  });

  it("a note that cannot play says so instead of doing nothing", () => {
    const v = read("src/modules/community/components/Voice.tsx");
    expect(v).toMatch(/onError=\{\(\) => \{/);
    expect(v).toMatch(/This voice message can't play here\./);
  });
});
