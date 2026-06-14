"use client";

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  // Avoid refetching the session on every tab focus - cuts redundant
  // /api/auth/session round-trips and makes navigation feel snappier.
  return (
    <SessionProvider refetchOnWindowFocus={false}>{children}</SessionProvider>
  );
}
