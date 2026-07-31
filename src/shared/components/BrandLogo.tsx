"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Shows a dedicated logo image if it exists in /public, otherwise falls back
 * to a branded initials avatar. Swap in your own image by placing it at the
 * given path (e.g. /public/web3-academy.jpg).
 */
export function BrandLogo({
  logo,
  initials,
  name,
  className,
}: {
  logo: string;
  initials: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-ink-700 to-ink-900 ring-1 ring-gold-500/30",
        className
      )}
    >
      <span className="font-display text-xl font-extrabold text-gold-gradient">{initials}</span>
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={name}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
