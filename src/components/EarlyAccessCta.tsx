"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

/**
 * Session-aware CTA: signed-out users get the signup/early-access button,
 * account holders get "Explore Research" instead (they already have access).
 * Client-side check so ISR pages stay cacheable.
 */
export function EarlyAccessCta({
  className = "btn-primary",
  label = "Get early access",
}: {
  className?: string;
  label?: string;
}) {
  const { data: session } = useSession();
  return session ? (
    <Link href="/research" className={className}>
      Explore Research
    </Link>
  ) : (
    <Link href="/signup" className={className}>
      {label}
    </Link>
  );
}
