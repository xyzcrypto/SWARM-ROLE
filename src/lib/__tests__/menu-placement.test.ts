import { describe, expect, it } from "vitest";
import { placeMenu } from "@shared/utils/menu-placement";

// The DM message menu, sized as it renders: 7 items at min-h-10 plus the
// wrapper's py-1 ≈ 288px, in a 176px-wide box.
const W = 176;
const MENU_H = 288;
const opts = { width: W, align: "right" as const };

// iPhone 13 viewport. The DM thread is the full height minus the app header and
// the composer, but the menu is `fixed`, so the viewport is what bounds it.
const VW = 390;
const VH = 844;

/** A ⋮ trigger (h-7) whose top sits `y` px down the viewport. */
const trigger = (y: number, right = 360) => ({ top: y, bottom: y + 28, left: right - 28, right });

/** Where the menu's top edge lands, whichever way it opened. */
const topEdge = (b: ReturnType<typeof placeMenu>, vh = VH) =>
  b.placement === "down" ? b.top! : vh - b.bottom! - Math.min(MENU_H, b.maxHeight);

describe("placeMenu keeps the whole menu on screen", () => {
  // ⚠️ This is the bug. The old menu was `absolute bottom-full` inside the
  // message list's `overflow-y-auto`, so a message near the top of the thread
  // put ~200px of menu above the container - clipped, starting with Reply,
  // which is the first item. On a phone that read as "reply doesn't work".
  it("does not run off the top for a message near the top of the thread", () => {
    const b = placeMenu(trigger(90), VW, VH, opts);
    expect(topEdge(b)).toBeGreaterThanOrEqual(0);
    // 90px of headroom cannot hold a 288px menu, so it must flip below.
    expect(b.placement).toBe("down");
  });

  it("does not run off the bottom for a message at the end of the thread", () => {
    const b = placeMenu(trigger(VH - 120), VW, VH, opts);
    expect(b.placement).toBe("up");
    expect(topEdge(b)).toBeGreaterThanOrEqual(0);
    expect(VH - b.bottom!).toBeLessThanOrEqual(VH);
  });

  it("never reports more height than the side it chose actually has", () => {
    for (let y = 0; y < VH - 28; y += 7) {
      const b = placeMenu(trigger(y), VW, VH, opts);
      const bottomEdge = topEdge(b) + Math.min(MENU_H, b.maxHeight);
      expect(topEdge(b)).toBeGreaterThanOrEqual(0);
      expect(bottomEdge).toBeLessThanOrEqual(VH);
    }
  });

  // Opening upward was the original design and is still right where it fits:
  // the menu must not cover the message you are about to delete.
  it("prefers opening upward when there is room", () => {
    expect(placeMenu(trigger(500), VW, VH, opts).placement).toBe("up");
  });

  // A short landscape phone has room on neither side. It still has to render
  // something usable, so it takes the larger half and scrolls.
  it("falls back to the roomier side and caps the height when neither fits", () => {
    const shortVh = 360;
    const b = placeMenu(trigger(300), VW, shortVh, opts);
    expect(b.maxHeight).toBeGreaterThan(0);
    expect(b.maxHeight).toBeLessThan(MENU_H);
    expect(topEdge(b, shortVh)).toBeGreaterThanOrEqual(0);
  });
});

describe("placeMenu keeps the menu inside the viewport horizontally", () => {
  it("right-aligns to the trigger without crossing the left edge", () => {
    // A trigger hard against the left of a narrow screen: right-aligning it
    // naively gives a negative left.
    const b = placeMenu(trigger(400, 40), VW, VH, opts);
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.left + W).toBeLessThanOrEqual(VW);
  });

  it("left-aligns to the trigger without crossing the right edge", () => {
    const b = placeMenu({ top: 400, bottom: 428, left: VW - 30, right: VW - 2 }, VW, VH, {
      width: W,
      align: "left",
    });
    expect(b.left + W).toBeLessThanOrEqual(VW);
  });

  // clamp(lo > hi) inverts, which would push the menu off-screen on the one
  // viewport where being on-screen matters most.
  it("pins to the margin rather than inverting on a viewport narrower than the menu", () => {
    const b = placeMenu(trigger(400, 100), 150, VH, opts);
    expect(b.left).toBe(8);
  });
});
