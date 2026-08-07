import { describe, expect, it } from "vitest";
import { clampPanelSize, MIN_W, MIN_H } from "@/shared/hooks/useResizablePanel";

describe("clamping the AI panel size", () => {
  it("leaves a reasonable size alone", () => {
    expect(clampPanelSize({ w: 480, h: 620 }, 1440, 900)).toEqual({ w: 480, h: 620 });
  });

  it("never shrinks below a usable minimum", () => {
    expect(clampPanelSize({ w: 50, h: 50 }, 1440, 900)).toEqual({ w: MIN_W, h: MIN_H });
  });

  it("never grows past the viewport", () => {
    const out = clampPanelSize({ w: 9999, h: 9999 }, 1200, 800);
    expect(out).toEqual({ w: Math.round(1200 * 0.96), h: Math.round(800 * 0.92) });
  });

  // A size saved on a desktop must not leave the panel wider than a phone.
  it("re-clamps a desktop size onto a phone viewport", () => {
    const saved = clampPanelSize({ w: 900, h: 700 }, 1440, 900);
    const onPhone = clampPanelSize(saved, 390, 844);
    expect(onPhone.w).toBeLessThanOrEqual(Math.round(390 * 0.96));
  });

  // On a very small screen the minimum has to win, or the panel becomes unusable.
  it("keeps the minimum when the viewport is smaller than it", () => {
    const out = clampPanelSize({ w: 400, h: 500 }, 200, 200);
    expect(out).toEqual({ w: MIN_W, h: MIN_H });
  });

  it("rounds to whole pixels", () => {
    expect(clampPanelSize({ w: 480.6, h: 620.4 }, 1440, 900)).toEqual({ w: 481, h: 620 });
  });
});
