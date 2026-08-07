"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Drag the assistant anywhere on screen and keep it there between visits.
//
// Offsets are stored relative to the panel's CSS anchor (bottom-right), not as
// absolute coordinates, so the saved position survives a window resize and a
// different monitor. A position restored off-screen is clamped back into view
// on mount - otherwise a panel dragged to the edge of a wide desktop window
// would be unreachable on a laptop.
//
// Pointer Events, not mouse+touch: one code path covers mouse, touch and pen,
// and pointer capture means the drag keeps tracking even when the cursor
// leaves the header.

const KEY = "xyz-ai:panel-offset";

export type Offset = { x: number; y: number };

function clampToViewport(o: Offset, el: HTMLElement | null): Offset {
  if (typeof window === "undefined" || !el) return o;
  const r = el.getBoundingClientRect();
  // The element is anchored bottom-right, so a positive x moves it left.
  const maxX = Math.max(0, window.innerWidth - r.width);
  const maxY = Math.max(0, window.innerHeight - r.height);
  return {
    x: Math.min(Math.max(o.x, -0), maxX),
    y: Math.min(Math.max(o.y, -0), maxY),
  };
}

export function useDraggablePanel(enabled: boolean) {
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const elRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // Restore in an effect, never during render - localStorage is a client-only
  // signal and reading it while rendering would desync server and client DOM.
  useEffect(() => {
    if (!enabled) return;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
        setOffset(clampToViewport(parsed, elRef.current));
      }
    } catch {
      // Corrupt or unavailable storage just means the default position.
    }
  }, [enabled]);

  // Keep it reachable when the window shrinks.
  useEffect(() => {
    if (!enabled) return;
    const onResize = () => setOffset((o) => clampToViewport(o, elRef.current));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [enabled]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      // Let buttons inside the drag handle still be clickable.
      if ((e.target as HTMLElement)?.closest("button,a,input,textarea")) return;
      const el = elRef.current;
      if (!el) return;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      startRef.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
      setDragging(true);
    },
    [enabled, offset.x, offset.y]
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = startRef.current;
    if (!s) return;
    // Anchored bottom-right: dragging left/up increases the offset.
    setOffset(clampToViewport({ x: s.ox - (e.clientX - s.px), y: s.oy - (e.clientY - s.py) }, elRef.current));
  }, []);

  const endDrag = useCallback(() => {
    if (!startRef.current) return;
    startRef.current = null;
    setDragging(false);
    setOffset((o) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(o));
      } catch {
        // Private mode / quota - the position just won't persist.
      }
      return o;
    });
  }, []);

  const reset = useCallback(() => {
    setOffset({ x: 0, y: 0 });
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* nothing to clean up */
    }
  }, []);

  return {
    ref: elRef,
    offset,
    dragging,
    reset,
    moved: offset.x !== 0 || offset.y !== 0,
    handleProps: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag },
  };
}
