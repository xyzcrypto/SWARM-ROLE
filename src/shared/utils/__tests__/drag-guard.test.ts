import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// A drag handle that captures the pointer on pointerdown redirects the
// subsequent click to itself, so every control inside the handle stops
// responding. That is exactly what broke Clear chat and Close: the guard
// existed, was dropped in a rewrite, and took the header's buttons with it.
//
// Reads the real hook source. There is no DOM in this project's vitest setup,
// so the invariant is pinned structurally rather than by simulating pointers -
// worth stating plainly: this proves the guard is present, not that a click
// lands.
const src = readFileSync("src/shared/hooks/useDraggablePanel.ts", "utf8");

describe("drag handle must not swallow clicks on its controls", () => {
  it("ignores a press that starts on an interactive element", () => {
    expect(src).toMatch(/closest\?\.\(\s*"button,a,input,textarea,select,\[role='button'\]"\s*\)/);
  });

  it("captures the pointer only once movement passes the threshold", () => {
    const capture = src.indexOf("setPointerCapture");
    const move = src.indexOf("onPointerMove");
    const down = src.indexOf("onPointerDown");
    expect(capture).toBeGreaterThan(-1);
    // Capture must live in the move handler, not the down handler.
    expect(capture).toBeGreaterThan(move > down ? move : down);
    expect(src).toMatch(/if \(!movedRef\.current\) \{[\s\S]*?setPointerCapture/);
  });

  it("keeps a movement threshold so a tap is never treated as a drag", () => {
    expect(src).toMatch(/DRAG_THRESHOLD\s*=\s*6/);
    expect(src).toMatch(/Math\.hypot\(dx, dy\) < DRAG_THRESHOLD/);
  });
});
