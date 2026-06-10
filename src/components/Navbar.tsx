"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { Menu, X, LayoutDashboard } from "lucide-react";
import { navLinks } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const [signingOut, setSigningOut] = useState(false);

  // Robust sign-out: clear the session via the API (no server redirect that
  // depends on NEXTAUTH_URL), then hard-navigate home so the UI always updates.
  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut({ redirect: false });
    } finally {
      window.location.href = "/";
    }
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3">
      <nav
        className={cn(
          "mx-auto flex h-14 max-w-[1200px] items-center justify-between rounded-2xl px-3 transition-all duration-300 sm:px-4 xl:max-w-[1320px] 2xl:max-w-[1480px]",
          scrolled
            ? "border border-line bg-ink-900/80 shadow-elevate backdrop-blur-xl"
            : "border border-transparent"
        )}
      >
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative inline-flex h-8 w-8 overflow-hidden rounded-lg ring-1 ring-gold-500/40 transition-transform group-hover:scale-105">
            <Image src="/logo.jpg" alt="XYZ Crypto" fill className="object-cover" sizes="32px" />
          </span>
          <span className="font-display text-[15px] font-semibold tracking-tight">
            <span className="text-gold-gradient">XYZ</span>{" "}
            <span className="text-zinc-100">Crypto</span>
          </span>
        </Link>

        <div className="hidden items-center gap-0.5 md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="group relative rounded-lg px-3.5 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-100"
            >
              {l.label}
              <span className="absolute inset-x-3.5 -bottom-0.5 h-px scale-x-0 bg-gradient-to-r from-transparent via-gold-400 to-transparent transition-transform duration-300 group-hover:scale-x-100" />
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {session ? (
            <>
              {isAdmin && (
                <Link href="/dashboard" className="btn-ghost !px-3.5 !py-2 text-[13px]">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
              )}
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-100 disabled:opacity-60"
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:text-zinc-100"
              >
                Log in
              </Link>
              <Link href="/signup" className="btn-primary !px-4 !py-2 text-[13px]">
                Get Started
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-zinc-300 md:hidden"
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="mx-auto mt-2 max-w-container rounded-2xl border border-line bg-ink-900/95 p-3 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-0.5">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-300 hover:bg-white/5"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3">
              {session ? (
                <>
                  {isAdmin && (
                    <Link href="/dashboard" onClick={() => setOpen(false)} className="btn-ghost">
                      Dashboard
                    </Link>
                  )}
                  <button onClick={handleSignOut} disabled={signingOut} className="btn-ghost disabled:opacity-60">
                    {signingOut ? "Signing out…" : "Sign out"}
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setOpen(false)} className="btn-ghost">
                    Log in
                  </Link>
                  <Link href="/signup" onClick={() => setOpen(false)} className="btn-primary">
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
