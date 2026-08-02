"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Pencil } from "lucide-react";

// Shown only on your OWN profile - a quick link to edit it in Settings. Gated
// client-side (the profile page is ISR-cached and doesn't know the viewer).
export function EditProfileButton({ username }: { username: string }) {
  const { data: session, status } = useSession();
  const me = (session?.user as { username?: string } | undefined)?.username;
  if (status !== "authenticated" || !me || me.toLowerCase() !== username.toLowerCase()) return null;

  return (
    <Link
      href="/settings"
      className="btn-secondary inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px]"
    >
      <Pencil className="h-3.5 w-3.5" /> Edit
    </Link>
  );
}
