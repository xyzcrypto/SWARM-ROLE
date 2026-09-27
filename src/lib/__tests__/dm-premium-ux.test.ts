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
