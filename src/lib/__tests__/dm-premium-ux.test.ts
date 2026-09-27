import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
const raw = readFileSync("src/modules/messages/components/MessagesClient.tsx", "utf8");
// ⚠️ `accept="image/*"` contains "/*", which a naive comment stripper reads as
// the start of a block comment and swallows code up to the next "*/". Where an
// assertion must see real code, use `raw`.
const dm = strip(raw);
const hook = strip(readFileSync("src/shared/hooks/useAutoGrow.ts", "utf8"));

describe("the DM composer", () => {
  it("grows, through the shared hook", () => {
    // The same `rows={1}`-and-nothing-grows bug the room had.
    expect(dm).toMatch(/useAutoGrow\(composerRef, DM_COMPOSER_MAX_H, \[draft, touchUi\]\)/);
    expect(dm).not.toMatch(/max-h-32 min-h-\[44px\]/);
  });

  it("lets a phone type a line break", () => {
    // Enter always sent, and phone keyboards have no Shift.
    // Both the composer AND the edit box.
    expect([...raw.matchAll(/e\.key === "Enter" && !e\.shiftKey && !touchUi/g)]).toHaveLength(2);
  });

  it("the hook keeps all three fixes the room learned", () => {
    expect(hook).toMatch(/el\.style\.height = "auto";/);
    expect(hook).toMatch(/new ResizeObserver\(/);
    expect(hook).toMatch(/el\.clientWidth !== lastWidth/);
  });
});

describe("the rest of the thread", () => {
  it("gives the actions trigger a 44px target on touch, in CSS", () => {
    expect(dm).toMatch(/\[@media\(hover:none\)\]:h-11 \[@media\(hover:none\)\]:w-11/);
  });

  it("offers a way back to the bottom whenever you are away from it", () => {
    expect(dm).toMatch(/\(hasNew \|\| !stick\) && loaded/);
  });

  it("uses the room's appearance, not a copy", () => {
    expect(dm).toMatch(/from "@modules\/community\/components\/useChatAppearance"/);
    expect(dm).toMatch(/<ChatWallpaper/);
    expect(dm).toMatch(/<ChatAppearanceSheet/);
  });
});

describe("the DM composer IS the room's composer, visually", () => {
  // Asked for directly: "message send wala bhi same as chat section". Pinned
  // against the room's source rather than a copied string, so if the room's
  // composer changes, this fails until DMs follow.
  const room = readFileSync("src/modules/community/components/ChatClient.tsx", "utf8");
  const cls = (src: string, anchor: RegExp) => {
    const at = src.search(anchor);
    expect(at, String(anchor)).toBeGreaterThan(-1);
    return src.slice(at).match(/className="([^"]+)"/)![1];
  };

  it("same textarea classes, including the 16px floor that stops iOS zooming", () => {
    const a = cls(room, /aria-label="Write a message"/);
    const b = cls(raw, /aria-label="Write a message"/);
    expect(b).toBe(a);
    expect(b).toMatch(/text-base/);
  });

  it("same send button", () => {
    expect(cls(raw, /aria-label="Send message"/)).toBe(cls(room, /whileTap=\{\{ scale: 0\.9 \}\}/));
  });

  it("same appearance button", () => {
    const a = cls(room, /aria-label="Chat appearance"/);
    const b = cls(raw, /aria-label="Chat appearance"/);
    expect(b.replace(/^ml-auto /, "").replace(" shrink-0", "")).toBe(a);
  });
});
