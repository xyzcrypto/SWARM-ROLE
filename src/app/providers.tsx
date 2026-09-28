"use client";

import { SessionProvider } from "next-auth/react";
import { MotionConfig } from "framer-motion";
import { useSitePrefs } from "@shared/utils/site-prefs";

export function Providers({ children }: { children: React.ReactNode }) {
  // "Animations: Off" in Customize website. CSS stops CSS animations
  // (`html.motion-off`); framer-motion runs its own JS loop, so it is told
  // here. MotionConfig is context only - it renders no DOM - so switching it
  // after hydration cannot mismatch anything. "never" is framer's own default,
  // so for everyone who has not chosen Off nothing changes.
  const { motion } = useSitePrefs();
  // Avoid refetching the session on every tab focus - cuts redundant
  // /api/auth/session round-trips and makes navigation feel snappier.
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <MotionConfig reducedMotion={motion === "off" ? "always" : "never"}>{children}</MotionConfig>
    </SessionProvider>
  );
}
