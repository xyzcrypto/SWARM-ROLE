"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import { Menu, X, LayoutDashboard, User, Settings, LogOut, ChevronDown } from "lucide-react";
import { navLinks } from "@/lib/site";
import { cn, maskEmail } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { ActionLink } from "./ActionLink";
import { MagneticButton } from "./MagneticButton";
import { isStaff } from "@/lib/permissions";
import { NavActivity } from "./NavActivity";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
  const { data: session } = useSession();
  const user = session?.user as any;
  // Show the Dashboard link to any staff member — Super Admin OR anyone granted
  // at least one capability — not just role === "ADMIN".
  const canSeeDashboard = isStaff(user);
  const isPremium = user?.membership === "Premium";
  const username = user?.username as string | undefined;
  const masked = maskEmail(session?.user?.email);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Close the account dropdown on outside click / Escape.
  useEffect(() => {
    if (!menu) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  // Always resolve to a real profile: /u/<handle> when known, else /profile
  // (a server route that mints a handle and redirects). Never Settings.
  const profileHref = username ? `/u/${username}` : "/profile";

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3">
      <nav
        className={cn(
          "mx-auto flex h-14 max-w-[1200px] items-center justify-between rounded-2xl px-3 transition-all duration-300 sm:px-4 xl:max-w-[1320px] 2xl:max-w-[1480px]",
          scrolled
            ? "border border-line bg-ink-900/80 shadow-elevate ring-1 ring-gold-500/10 backdrop-blur-xl"
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
              aria-current={isActive(l.href) ? "page" : undefined}
              className={cn(
                "group relative rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                isActive(l.href) ? "text-zinc-50" : "text-zinc-400 hover:text-zinc-100"
              )}
            >
              {l.label}
              <span
                className={cn(
                  "absolute inset-x-3.5 -bottom-0.5 h-px bg-gradient-to-r from-transparent via-gold-400 to-transparent transition-transform duration-300",
                  isActive(l.href) ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                )}
              />
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {session ? (
            <>
              <NavActivity />
            <div className="relative" ref={menuRef}>
              {/* Account button - avatar + membership, opens a dropdown */}
              <motion.button
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                onClick={() => setMenu((v) => !v)}
                className="flex items-center gap-2 rounded-xl border border-line bg-white/5 py-1.5 pl-1.5 pr-2.5 transition-colors hover:border-gold-500/30 hover:bg-white/[0.07]"
              >
                {/* Avatar with a gentle gold ring pulse (active presence cue). */}
                <span className="relative inline-flex">
                  <span className="pointer-events-none absolute -inset-0.5 rounded-full ring-1 ring-gold-500/40 [animation:ping-soft_3s_ease-in-out_infinite]" />
                  <Avatar name={session.user?.name} image={session.user?.image} email={session.user?.email} size="sm" />
                </span>
                <span className="flex flex-col items-start leading-tight">
                  <span className="mono text-[12px] text-zinc-200">{masked}</span>
                  <span className={cn("text-[10px] font-semibold uppercase tracking-wide", isPremium ? "text-gold-300" : "text-zinc-500")}>
                    {isPremium ? "Premium" : "Free"}
                  </span>
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-zinc-500 transition-transform", menu && "rotate-180")} />
              </motion.button>

              <AnimatePresence>
                {menu && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                    className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-line bg-ink-900/95 p-1.5 shadow-elevate backdrop-blur-xl"
                  >
                    <MenuItem href={profileHref} icon={<User className="h-4 w-4" />} onClick={() => setMenu(false)}>
                      Profile
                    </MenuItem>
                    <MenuItem href="/settings" icon={<Settings className="h-4 w-4" />} onClick={() => setMenu(false)}>
                      Settings
                    </MenuItem>
                    {canSeeDashboard && (
                      <MenuItem href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} onClick={() => setMenu(false)}>
                        Dashboard
                      </MenuItem>
                    )}
                    <div className="my-1 h-px bg-white/5" />
                    <button
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-zinc-100 disabled:opacity-60"
                    >
                      <LogOut className="h-4 w-4" />
                      {signingOut ? "Signing out…" : "Sign out"}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:text-zinc-100"
              >
                Log in
              </Link>
              <MagneticButton>
                <ActionLink href="/signup" className="btn-primary !px-4 !py-2 text-[13px]">
                  Get Started
                </ActionLink>
              </MagneticButton>
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
                aria-current={isActive(l.href) ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive(l.href)
                    ? "bg-white/5 text-gold-200"
                    : "text-zinc-300 hover:bg-white/5 hover:text-zinc-100"
                )}
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3">
              <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                <span className="text-sm font-medium text-zinc-300">Theme</span>
                <ThemeToggle />
              </div>
              {session ? (
                <>
                  <div className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2">
                    <Avatar name={session.user?.name} image={session.user?.image} email={session.user?.email} size="sm" />
                    <span className="flex flex-col leading-tight">
                      <span className="mono text-[12px] text-zinc-200">{masked}</span>
                      <span className={cn("text-[10px] font-semibold uppercase tracking-wide", isPremium ? "text-gold-300" : "text-zinc-500")}>
                        {isPremium ? "Premium" : "Free"}
                      </span>
                    </span>
                  </div>
                  <Link href={profileHref} onClick={() => setOpen(false)} className="btn-ghost">
                    Profile
                  </Link>
                  <Link href="/settings" onClick={() => setOpen(false)} className="btn-ghost">
                    Settings
                  </Link>
                  {canSeeDashboard && (
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
                  <ActionLink href="/signup" onClick={() => setOpen(false)} className="btn-primary">
                    Get Started
                  </ActionLink>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function MenuItem({
  href,
  icon,
  children,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-gold-100"
    >
      {icon}
      {children}
    </Link>
  );
}
