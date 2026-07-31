"use client";

import { useSession } from "next-auth/react";

/**
 * Renders its children only for signed-in members (the inverse of GuestOnly).
 * Use it to show member-appropriate CTAs in place of sign-up prompts. Client-side
 * so pages can stay statically/ISR cached (no per-request server session read).
 */
export function SignedIn({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  if (status === "loading" || !session?.user) return null;
  return <>{children}</>;
}
