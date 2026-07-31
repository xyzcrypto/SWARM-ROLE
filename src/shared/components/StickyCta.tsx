"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowRight } from "lucide-react";
import { ActionLink } from "@/components/ActionLink";

/**
 * Persistent bottom CTA bar on mobile only. Appears after the user scrolls
 * past the hero, and hides for signed-in users.
 */
export function StickyCta() {
  const { data: session } = useSession();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 640);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (session) return null;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 px-3 pb-3 transition-all duration-300 md:hidden ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
      }`}
    >
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-ink-900/90 px-4 py-3 shadow-elevate backdrop-blur-xl">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-100">
            Join XYZ Crypto, free
          </p>
          <p className="truncate text-[11px] text-zinc-500">
            Research, tools & early access
          </p>
        </div>
        <ActionLink href="/signup" className="btn-primary shrink-0 !px-4 !py-2 text-[13px]">
          Get started
          <ArrowRight className="h-4 w-4" />
        </ActionLink>
      </div>
    </div>
  );
}
