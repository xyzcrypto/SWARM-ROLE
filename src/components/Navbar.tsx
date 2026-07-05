"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { navLinks } from "@/lib/site";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  /* Scroll → frosted glass */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Active section via IntersectionObserver */
  useEffect(() => {
    const sectionIds = navLinks
      .map((l) => l.href.replace("/#", ""))
      .filter((id) => !id.startsWith("/"));

    const observers: IntersectionObserver[] = [];

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(id);
        },
        { threshold: 0.25, rootMargin: "-80px 0px -55% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const isActive = (href: string) => {
    if (href.startsWith("/#")) return activeSection === href.replace("/#", "");
    return false;
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "border-b border-white/[0.05] bg-black/92 shadow-[0_1px_60px_-12px_rgba(0,0,0,1)] backdrop-blur-2xl"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Logo */}
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <span className="relative inline-flex h-8 w-8 overflow-hidden rounded-full ring-1 ring-gold-400/35 shadow-[0_0_14px_-3px_rgba(233,160,32,0.45)] transition-all duration-300 group-hover:shadow-[0_0_22px_-3px_rgba(233,160,32,0.75)] group-hover:ring-gold-400/60">
            <Image src="/logo.jpg" alt="XYZ Crypto" fill className="object-cover" sizes="32px" />
          </span>
          <span className="font-display text-[0.98rem] font-bold tracking-tight">
            <span className="text-gold-gradient">XYZ</span>{" "}
            <span className="text-zinc-100">Crypto</span>
          </span>
        </Link>

        {/* Desktop nav pill */}
        <div className="hidden md:flex">
          <div className="flex items-center gap-0.5 rounded-full border border-white/[0.06] bg-white/[0.025] px-1 py-0.5 backdrop-blur-md">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-4 py-1.5 text-[0.82rem] font-medium transition-all duration-200 ${
                  isActive(l.href)
                    ? "nav-active"
                    : "text-zinc-400 hover:bg-white/[0.07] hover:text-gold-100"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Desktop auth */}
        <div className="hidden items-center gap-2 md:flex">
          {session ? (
            <>
              {isAdmin && (
                <Link
                  href="/dashboard"
                  className="rounded-full px-4 py-1.5 text-[0.82rem] font-medium text-zinc-400 transition-colors hover:text-gold-100"
                >
                  Dashboard
                </Link>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-full px-4 py-1.5 text-[0.82rem] font-medium text-zinc-400 transition-colors hover:text-zinc-200"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-4 py-1.5 text-[0.82rem] font-medium text-zinc-400 transition-colors hover:text-zinc-200"
              >
                Log in
              </Link>
              <Link href="/signup" className="btn-gold-sm">
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-zinc-300 transition-colors hover:border-gold-400/30 hover:text-gold-100 md:hidden"
          aria-label="Toggle menu"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? (
              <path d="M18 6 6 18M6 6l12 12" />
            ) : (
              <>
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="16" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </>
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile panel */}
      {open && (
        <div className="border-t border-white/[0.05] bg-black/96 px-4 pb-6 pt-3 backdrop-blur-2xl md:hidden">
          <nav className="flex flex-col gap-0.5">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  isActive(l.href)
                    ? "text-gold-100 bg-gold-400/8"
                    : "text-zinc-300 hover:bg-white/[0.04] hover:text-gold-100"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2 border-t border-white/[0.05] pt-4">
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
      )}
    </header>
  );
}
