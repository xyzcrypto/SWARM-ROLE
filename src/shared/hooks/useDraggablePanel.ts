"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Drag a bottom-right-anchored element anywhere on screen and keep it there.
// Used by both the XYZ AI launcher and the panel itself.
//
// Offsets are stored relative to the CSS anchor, not as absolute coordinates,
// so a saved position survives a window resize and a different monitor. A
// restored position is clamped back into view on mount - otherwise something
// dragged to the edge of a wide desktop window would be unreachable on a phone.
//
// Pointer Events, not mouse+touch: one code path covers mouse, touch and pen,
// and pointer capture keeps the drag tracking when the pointer leaves the
// handle.

export type Offset = { x: number; y: number };

/** Movement past this many px counts as a drag, not a tap. */
const DRAG_THRESHOLD = 6;

function clampToViewport(o: Offset, el: HTMLElement | null): Offset {
  if (typeof window === "undefined" || !el) return o;
  const r = el.getBoundingClientRect();
  // Anchored bottom-right, so a positive offset moves it left/up.
  return {
    x: Math.min(Math.max(o.x, 0), Math.max(0, window.innerWidth - r.width)),
    y: Math.min(Math.max(o.y, 0), Math.max(0, window.innerHeight - r.height)),
  };
}

export function useDraggablePanel(enabled: boolean, storageKey: string) {
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const elRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  // Set once a gesture passes the threshold, so a click handler can tell a tap
  // from the end of a drag. Without this, moving the launcher would also open
  // the panel every time.
  const movedRef = useRef(false);

  // Restore in an effect, never during render - localStorage is a client-only
  // signal and reading it while rendering would desync server and client DOM.
  useEffect(() => {
    if (!enabled) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
        setOffset(clampToViewport(parsed, elRef.current));
      }
    } catch {
      // Corrupt or unavailable storage just means the default position.
    }
  }, [enabled, storageKey]);

  useEffect(() => {
    if (!enabled) return;
    const onResize = () => setOffset((o) => clampToViewport(o, elRef.current));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [enabled]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || !elRef.current) return;
      // A press that starts on a control is that control's, not the drag's.
      // Without this the header swallowed every click on Clear chat and Close,
      // because pointer capture (below) redirects the click to the capturing
      // element. This guard existed, was dropped in a rewrite, and took the
      // header's buttons with it.
      if ((e.target as HTMLElement)?.closest?.("button,a,input,textarea,select,[role='button'],[data-resize]")) return;
      startRef.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
      movedRef.current = false;
    },
    [enabled, offset.x, offset.y]
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = startRef.current;
    if (!s) return;
    const dx = e.clientX - s.px;
    const dy = e.clientY - s.py;
    if (!movedRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!movedRef.current) {
      // Capture only once this is genuinely a drag. Capturing on pointerdown
      // would redirect the subsequent click to this element and break every
      // control inside it, even for a press that never moved.
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      movedRef.current = true;
      setDragging(true);
    }
    setOffset(clampToViewport({ x: s.ox - dx, y: s.oy - dy }, elRef.current));
  }, []);

  const endDrag = useCallback(() => {
    if (!startRef.current) return;
    startRef.current = null;
    setDragging(false);
    if (!movedRef.current) return; // a tap - nothing to persist
    setOffset((o) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(o));
      } catch {
        // Private mode / quota - the position just won't persist.
      }
      return o;
    });
  }, [storageKey]);

  /** Shift the anchor by a delta - used when a resize from the right/bottom
   *  edge must keep the opposite edge visually still. */
  const nudge = useCallback((dx: number, dy: number) => {
    setOffset((o) => clampToViewport({ x: o.x + dx, y: o.y + dy }, elRef.current));
  }, []);

  const reset = useCallback(() => {
    setOffset({ x: 0, y: 0 });
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* nothing to clean up */
    }
  }, [storageKey]);

  return {
    ref: elRef,
    offset,
    dragging,
    reset,
    nudge,
    moved: offset.x !== 0 || offset.y !== 0,
    /** True if the gesture that just ended was a drag - use to suppress a click. */
    wasDragged: () => movedRef.current,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      // Stops the browser from scrolling/panning while dragging on touch.
      style: { touchAction: "none" as const },
    },
  };
}
