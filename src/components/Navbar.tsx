"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { navLinks } from "@/lib/site";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-white/5 bg-ink/80 backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative inline-flex h-9 w-9 overflow-hidden rounded-full ring-1 ring-gold-500/40 transition-transform group-hover:scale-105">
            <Image src="/logo.jpg" alt="XYZ Crypto" fill className="object-cover" sizes="36px" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            <span className="text-gold-gradient">XYZ</span>{" "}
            <span className="text-zinc-100">Crypto</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-gold-100"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {session ? (
            <>
              {isAdmin && (
                <Link href="/dashboard" className="btn-ghost !px-4 !py-2">
                  Dashboard
                </Link>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-full px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-gold-100"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:text-gold-100"
              >
                Log in
              </Link>
              <Link href="/signup" className="btn-gold !px-5 !py-2">
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
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="border-t border-white/5 bg-ink/95 px-4 py-4 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-1">
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
            <div className="mt-2 flex flex-col gap-2 border-t border-white/5 pt-3">
              {session ? (
                <>
                  {isAdmin && (
                    <Link href="/dashboard" onClick={() => setOpen(false)} className="btn-ghost">
                      Dashboard
                    </Link>
                  )}
                  <button onClick={() => signOut({ callbackUrl: "/" })} className="btn-ghost">
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setOpen(false)} className="btn-ghost">
                    Log in
                  </Link>
                  <Link href="/signup" onClick={() => setOpen(false)} className="btn-gold">
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
