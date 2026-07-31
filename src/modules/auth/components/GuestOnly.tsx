"use client";

import { useSession } from "next-auth/react";

/**
 * Renders its children only for signed-out visitors. Used to hide sign-up /
 * waitlist CTAs from members who already have an account. Client-side so the
 * homepage can stay ISR-cached (no per-request session read on the server).
 */
export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  if (status === "loading" || session?.user) return null;
  return <>{children}</>;
}
