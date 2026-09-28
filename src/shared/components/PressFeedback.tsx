"use client";

import { chatPressFeedback } from "@shared/utils/chat-feedback";

/**
 * Gives every control inside it the same press feedback as the chat surfaces:
 * a haptic tick (and, at the "Everything" sound level, a soft click), per the
 * member's Haptics & sound settings. `display: contents`, so it adds no box
 * and cannot change the layout of what it wraps. A client leaf, so a server
 * component (the ISR profile page) can wrap its markup without becoming
 * dynamic.
 */
export function PressFeedback({ children }: { children: React.ReactNode }) {
  return (
    <div className="contents" onPointerDownCapture={chatPressFeedback}>
      {children}
    </div>
  );
}
