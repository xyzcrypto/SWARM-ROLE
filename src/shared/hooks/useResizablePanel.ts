"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Resize a bottom-right-anchored panel from any edge or corner, and remember
// the size.
//
// The anchoring is what makes this non-obvious. The panel's CSS anchor is its
// bottom-right corner, and dragging moves it by an offset from that anchor. So:
//
//   - Pulling the LEFT edge left, or the TOP edge up, only changes the size -
//     the anchored corner does not move.
//   - Pulling the RIGHT or BOTTOM edge has to change the size AND the drag
//     offset together, or the panel would appear to slide instead of grow.
//
// Sizes are clamped to a usable minimum and to the viewport, and re-clamped on
// resize of the window, so a size saved on a desktop can't leave the panel
// wider than a phone.

export type Size = { w: number; h: number };
export type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const MIN_W = 320;
export const MIN_H = 340;

/**
 * Clamp a size to the usable minimum and to the viewport. Pure and exported so
 * the rules can be tested without a DOM - the viewport is passed in rather than
 * read from `window`.
 *
 * The minimum wins over the maximum on a very small screen: a panel narrower
 * than MIN_W is unusable, and letting the max drive it to 200px would be worse
 * than slightly overflowing.
 */
export function clampPanelSize(s: Size, vw: number, vh: number): Size {
  const maxW = Math.max(MIN_W, Math.round(vw * 0.96));
  const maxH = Math.max(MIN_H, Math.round(vh * 0.92));
  return {
    w: Math.min(Math.max(Math.round(s.w), MIN_W), maxW),
    h: Math.min(Math.max(Math.round(s.h), MIN_H), maxH),
  };
}

function clampSize(s: Size): Size {
  if (typeof window === "undefined") return s;
  return clampPanelSize(s, window.innerWidth, window.innerHeight);
}

export function useResizablePanel(
  storageKey: string,
  /** Lets a right/bottom resize move the anchor so the opposite edge stays put. */
  nudgeOffset: (dx: number, dy: number) => void
) {
  // Lazy initializer rather than a restore-in-effect. That is normally a
  // hydration hazard - reading localStorage during render makes the server and
  // client disagree - but this hook only ever runs inside XyzAiWidget, which is
  // mounted through `next/dynamic` with `ssr: false`. It never renders on the
  // server, so there is no server HTML to disagree with, and this avoids the
  // cascading extra render an effect would cause.
  const [size, setSize] = useState<Size | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (typeof p?.w === "number" && typeof p?.h === "number") return clampSize(p);
    } catch {
      // Corrupt or unavailable storage just means the default size.
    }
    return null; // null = use the CSS default
  });
  const [resizing, setResizing] = useState<Edge | null>(null);
  const elRef = useRef<HTMLElement | null>(null);
  const startRef = useRef<{ px: number; py: number; w: number; h: number; edge: Edge } | null>(null);

  // A size saved on a wide window must not outgrow a narrow one.
  useEffect(() => {
    const onResize = () => setSize((s) => (s ? clampSize(s) : s));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const begin = useCallback(
    (edge: Edge) => (e: React.PointerEvent) => {
      const el = elRef.current;
      if (!el) return;
      e.preventDefault();
      e.stopPropagation(); // never let a resize also start a drag
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      const r = el.getBoundingClientRect();
      startRef.current = { px: e.clientX, py: e.clientY, w: r.width, h: r.height, edge };
      setResizing(edge);
    },
    []
  );

  const move = useCallback(
    (e: React.PointerEvent) => {
      const s = startRef.current;
      if (!s) return;
      const dx = e.clientX - s.px;
      const dy = e.clientY - s.py;
      let w = s.w;
      let h = s.h;
      let nudgeX = 0;
      let nudgeY = 0;

      if (s.edge.includes("w")) w = s.w - dx; // pulling left grows it
      if (s.edge.includes("e")) w = s.w + dx;
      if (s.edge.includes("n")) h = s.h - dy; // pulling up grows it
      if (s.edge.includes("s")) h = s.h + dy;

      const next = clampSize({ w, h });
      // East/south move the anchored corner, so shift the offset by exactly the
      // growth that was actually applied after clamping - using the raw pointer
      // delta here would drift once the size hits a limit.
      if (s.edge.includes("e")) nudgeX = -(next.w - s.w);
      if (s.edge.includes("s")) nudgeY = -(next.h - s.h);

      setSize(next);
      if (nudgeX || nudgeY) {
        nudgeOffset(nudgeX, nudgeY);
        startRef.current = { ...s, px: e.clientX, py: e.clientY, w: next.w, h: next.h };
      }
    },
    [nudgeOffset]
  );

  const end = useCallback(() => {
    if (!startRef.current) return;
    startRef.current = null;
    setResizing(null);
    setSize((s) => {
      if (s) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(s));
        } catch {
          // Private mode / quota - the size just won't persist.
        }
      }
      return s;
    });
  }, [storageKey]);

  const reset = useCallback(() => {
    setSize(null);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* nothing to clean up */
    }
  }, [storageKey]);

  /** Props for one handle. `data-resize` also keeps the drag handler off it. */
  const handleProps = useCallback(
    (edge: Edge) => ({
      "data-resize": edge,
      onPointerDown: begin(edge),
      onPointerMove: move,
      onPointerUp: end,
      onPointerCancel: end,
      style: { touchAction: "none" as const },
    }),
    [begin, move, end]
  );

  return { ref: elRef, size, resizing, reset, resized: size !== null, handleProps };
}
