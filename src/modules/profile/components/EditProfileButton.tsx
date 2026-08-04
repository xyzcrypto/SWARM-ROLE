"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

// Shown only on your OWN profile - a quick link to edit it in Settings. Gated
// client-side (the profile page is ISR-cached and doesn't know the viewer).
//
// h-9 + text-sm deliberately matches MessageButton and CopyLinkButton: the three
// sit side by side in the profile header and each used to size itself, so the
// row came out with three different button heights.
export function EditProfileButton({ username, className }: { username: string; className?: string }) {
  const { data: session, status } = useSession();
  const me = (session?.user as { username?: string } | undefined)?.username;
  if (status !== "authenticated" || !me || me.toLowerCase() !== username.toLowerCase()) return null;

  return (
    <Link
      href="/settings"
      className={cn("btn-secondary inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm", className)}
    >
      <Pencil className="h-4 w-4" /> Edit
    </Link>
  );
}
