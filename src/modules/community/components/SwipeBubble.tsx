"use client";

import { useRef, useState } from "react";
import { CornerUpLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticTap, hapticToggle } from "@shared/utils/haptics";

/** How far a swipe has to travel before letting go replies. */
const REPLY_AT = 56;
/** Visual cap on the drag, so the bubble never leaves its lane. */
const MAX_DRAG = 80;
const LONG_PRESS_MS = 450;
const DOUBLE_TAP_MS = 300;

/**
 * Controls inside a message (play, speed, Text/Translate, links, a poll
 * option). A press that starts on one of these is THAT control's - it must
 * never also count toward the message's double-tap (❤️) or long-press. A probe
 * caught tapping the speed chip twice (1x -> 1.5x -> 2x) hearting the message.
 */
export const INTERACTIVE = 'button, a[href], input, textarea, select, audio, [role="button"], [role="slider"], [role="menuitem"], [contenteditable="true"]';
export const fromControl = (t: EventTarget | null) => !!(t as Element | null)?.closest?.(INTERACTIVE);

/**
 * The three gestures every messenger has taught people, on one message row:
 *
 * - **swipe right to reply** (touch/pen only - a mouse drag selects text)
 * - **long-press** for the actions menu (touch only)
 * - **double-tap** for the quick reaction
 *
 * Built on pointer events with `touch-action: pan-y`, so the browser still
 * owns vertical scrolling and only horizontal movement reaches this. The
 * moment a drag turns out to be vertical, the gesture lets go - scrolling the
 * thread must never be captured by a message.
 *
 * Every gesture has a button equivalent (the actions menu has Reply and the
 * reactions), so none of this is the only way to do anything.
 */
export function SwipeBubble({
  onReply,
  onLongPress,
  onDoubleTap,
  disabled,
  className,
  children,
}: {
  onReply?: () => void;
  onLongPress?: () => void;
  onDoubleTap?: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [dx, setDx] = useState(0);
  // ⚠️ The gesture reads the drag from a REF, never from `dx`. A handler
  // closes over the `dx` of the render it was created in, and pointer moves
  // can arrive faster than React re-renders - so on pointer-up `dx` could
  // still read 0 after a full swipe, and the reply silently did not happen.
  // A browser probe caught exactly that. `dx` state is for painting only.
  const drag = useRef(0);
  const start = useRef<{ x: number; y: number; touch: boolean; control: boolean } | null>(null);
  const moved = useRef(false);
  const armed = useRef(false);
  const press = useRef<number>(0);
  const lastTap = useRef(0);

  const clearPress = () => { window.clearTimeout(press.current); press.current = 0; };
  const reset = () => { clearPress(); start.current = null; armed.current = false; drag.current = 0; setDx(0); };

  return (
    <div
      className={cn("relative touch-pan-y", className)}
      onPointerDown={(e) => {
        if (disabled) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        const touch = e.pointerType !== "mouse";
        const control = fromControl(e.target);
        start.current = { x: e.clientX, y: e.clientY, touch, control };
        moved.current = false;
        if (control) lastTap.current = 0; // a control press breaks a double-tap sequence
        if (touch && onLongPress && !control) {
          press.current = window.setTimeout(() => {
            press.current = 0;
            moved.current = true; // a long-press is not also a tap
            hapticToggle();
            onLongPress();
          }, LONG_PRESS_MS);
        }
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s) return;
        const ddx = e.clientX - s.x;
        const ddy = e.clientY - s.y;
        if (Math.abs(ddx) > 8 || Math.abs(ddy) > 8) { clearPress(); moved.current = true; }
        // Vertical wins: this is someone scrolling the thread.
        if (Math.abs(ddy) > Math.abs(ddx) && Math.abs(ddy) > 8 && drag.current === 0) { start.current = null; return; }
        if (!s.touch || !onReply || ddx <= 0) return;
        const next = Math.min(ddx, MAX_DRAG);
        // One buzz as it crosses the line, so you feel the moment it will reply.
        if (next >= REPLY_AT && !armed.current) { armed.current = true; hapticTap(); }
        if (next < REPLY_AT) armed.current = false;
        drag.current = next;
        setDx(next);
      }}
      onPointerUp={() => {
        clearPress();
        const replied = armed.current && drag.current >= REPLY_AT;
        if (replied) onReply?.();
        if (!moved.current && onDoubleTap && !start.current?.control) {
          const now = Date.now();
          if (now - lastTap.current < DOUBLE_TAP_MS) { lastTap.current = 0; onDoubleTap(); }
          else lastTap.current = now;
        }
        reset();
      }}
      onPointerCancel={reset}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") reset(); }}
      onContextMenu={(e) => { if (start.current?.touch) e.preventDefault(); }}
    >
      {onReply && dx > 0 && (
        <span
          aria-hidden
          className={cn(
            "absolute left-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full transition-colors",
            dx >= REPLY_AT ? "bg-gold-500/25 text-gold-100" : "bg-white/[0.06] text-zinc-400"
          )}
          style={{ opacity: Math.min(1, dx / REPLY_AT) }}
        >
          <CornerUpLeft className="h-4 w-4" />
        </span>
      )}
      <div
        style={dx ? { transform: `translateX(${dx}px)` } : undefined}
        className={cn(dx === 0 && "transition-transform duration-200 ease-out")}
      >
        {children}
      </div>
    </div>
  );
}
