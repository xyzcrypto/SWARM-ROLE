"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import { Menu, X, LayoutDashboard, User, Settings, LogOut, ChevronDown, Search, MessageCircle, NotebookPen } from "lucide-react";
import { navLinks } from "@/lib/site";
import { XYZ_CMDK_EVENT } from "@/lib/command-search";
import { XYZ_AI_OPEN_EVENT } from "@/components/XyzAiWidget";
import { RobotIcon } from "@/components/RobotIcon";
import { cn, maskEmail } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { ActionLink } from "@/components/ActionLink";
import { MagneticButton } from "@/components/MagneticButton";
import { isStaff } from "@/lib/permissions";
import { NavActivity } from "@/components/NavActivity";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DailyCheckIn } from "@/components/DailyCheckIn";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
  const { data: session } = useSession();
  const user = session?.user as any;
  // Show the Dashboard link to any staff member - Super Admin OR anyone granted
  // at least one capability - not just role === "ADMIN".
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

  // Flag the open mobile drawer on <html> so the floating XYZ AI launcher can
  // get out of the way in CSS. It is `fixed` at z-[60] - above this menu - so
  // while the drawer was open it sat on top of the check-in row. A DOM flag
  // rather than shared state because the launcher is a sibling widget mounted
  // by the layout, with no component relationship to the navbar.
  useEffect(() => {
    const el = document.documentElement;
    if (open) el.setAttribute("data-nav-open", "");
    else el.removeAttribute("data-nav-open");
    return () => el.removeAttribute("data-nav-open");
  }, [open]);

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

  /**
   * Closing the drawer is all this does now.
   *
   * It used to also scroll to the top when you tapped the route you were
   * already on - because a same-route navigation does not reset scroll in Next,
   * so "Home" from halfway down the page left you where you were. That fix was
   * correct but it lived here, on this one link list, and the desktop rail, the
   * footer and the logo never got it. Measured while parked at the bottom of
   * the homepage: the drawer's Home went 13237px -> 0, while the footer's and
   * the rail's did not move at all.
   *
   * It is handled once at the document now (`SameRouteTopScroll`, mounted in
   * app/layout.tsx), so every link gets it including ones added later.
   */
  const closeMenu = () => setOpen(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3">
      <nav
        className={cn(
          "mx-auto flex h-14 max-w-[1200px] items-center justify-between rounded-2xl px-3 transition-all duration-300 sm:px-4 xl:max-w-[1320px] 2xl:max-w-[1480px]",
          scrolled
            ? // backdrop-blur-lg (not -xl) - the bar is fixed/sticky, so a full 24px
              // blur repaints on every scroll frame, site-wide, on every page. 16px
              // still reads as glassy at a fraction of the compositing cost. Mobile
              // gets a further reduction to 8px via .nav-shell in globals.css.
              "nav-shell border border-line bg-ink-900/80 shadow-elevate ring-1 ring-gold-500/10 backdrop-blur-lg"
            : "border border-transparent"
        )}
      >
        <Link href="/" className="group flex items-center gap-2.5">
          {/* The coin carries its own gold rim, so no ring and no rounded clip -
              both fought the artwork. object-contain keeps it whole. */}
          <span className="relative inline-flex h-9 w-9 transition-transform group-hover:scale-105 group-active:scale-105">
            <Image src="/logo.png" alt="XYZ Crypto" fill className="object-contain" sizes="36px" />
          </span>
          <span className="font-display text-[15px] font-semibold tracking-tight">
            <span className="text-gold-gradient">XYZ</span>{" "}
            <span className="text-zinc-100">Crypto</span>
          </span>
        </Link>

        {/* The desktop rail switches at `lg`, not `md`. At 768px it was shown
            but needed 1025px, so an iPad in portrait overflowed the page by
            257px horizontally - measured, and the reason this moved.
            The roomier per-link padding is `xl:` rather than `lg:` for the same
            reason one breakpoint up: at exactly 1024 (iPad landscape) the rail
            still needed 1089px and overflowed by 65px. Eight links x 8px is
            what buys that back. */}
        <div className="hidden items-center gap-0.5 lg:flex">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              prefetch={false}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={cn(
                "group relative rounded-lg px-2.5 py-2 text-sm font-medium transition-colors xl:px-3.5",
                isActive(l.href) ? "text-zinc-50" : "text-zinc-400 hover:text-zinc-100"
              )}
            >
              {l.label}
              <span
                className={cn(
                  "absolute inset-x-2.5 -bottom-0.5 h-px bg-gradient-to-r from-transparent via-gold-400 to-transparent transition-transform duration-300 xl:inset-x-3.5",
                  isActive(l.href) ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100 group-active:scale-x-100"
                )}
              />
            </Link>
          ))}
          {/* Dedicated XYZ AI launcher - transparent glass, live green pulse, 3D robot. */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(XYZ_AI_OPEN_EVENT))}
            className="ai-nav-btn ml-1 inline-flex items-center gap-1.5 rounded-lg border border-mint-500/50 bg-transparent px-3 py-1.5 text-sm font-semibold text-mint-700 transition-transform dark:border-mint-400/40 dark:text-mint-100"
          >
            <span className="relative z-10 inline-flex items-center gap-1.5">
              <RobotIcon className="ai-bot h-5 w-5" />
              XYZ AI
            </span>
          </button>
        </div>

        {/* Single mounted instance, shared between the desktop and mobile
            layouts below via flex order - Tailwind's hidden/lg:hidden only
            toggles CSS display, so two separate <NavActivity /> elements (one
            per breakpoint wrapper) used to double-mount it, doubling its
            60s-interval polling + realtime subscription at every viewport size. */}
        {session && <NavActivity />}

        <div className="hidden items-center gap-2 lg:flex">
          <button
            onClick={() => window.dispatchEvent(new Event(XYZ_CMDK_EVENT))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white/5 text-zinc-400 transition-colors hover:border-gold-500/30 hover:text-zinc-200"
            aria-label="Search (⌘K)"
            title="Search - ⌘K"
          >
            <Search className="h-4 w-4" />
          </button>
          <ThemeToggle />
          {session ? (
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
                  <Avatar name={session.user?.name} image={session.user?.image} email={session.user?.email} size="sm" premium={isPremium} />
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
                    <MenuItem href="/messages" icon={<MessageCircle className="h-4 w-4" />} onClick={() => setMenu(false)}>
                      Messages
                    </MenuItem>
                    <MenuItem href="/journal" icon={<NotebookPen className="h-4 w-4" />} onClick={() => setMenu(false)}>
                      Journal
                    </MenuItem>
                    <MenuItem href="/settings" icon={<Settings className="h-4 w-4" />} onClick={() => setMenu(false)}>
                      Settings
                    </MenuItem>
                    {canSeeDashboard && (
                      <MenuItem href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} onClick={() => setMenu(false)}>
                        Dashboard
                      </MenuItem>
                    )}
                    <DailyCheckIn />
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
          ) : (
            <>
              <Link
                href="/login"
                prefetch={false}
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

        <div className="flex items-center lg:hidden">
          <button
            onClick={() => window.dispatchEvent(new Event(XYZ_CMDK_EVENT))}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-zinc-300"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-zinc-300"
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {open && (
        // The drawer has to end ABOVE the fixed bottom nav, not behind it.
        // `100dvh - 6rem` only reserved room for the header, so the last rows -
        // the check-in line and Sign out - sat underneath the bar and could not
        // be reached at all. The bar is 3.5rem plus the safe-area inset (see
        // BottomNav), so both come off the height, and the same amount is added
        // back as padding so the final row can still scroll clear of it.
        <div
          className="mx-auto mt-2 max-h-[calc(100dvh-6rem-3.5rem-env(safe-area-inset-bottom))] max-w-container overflow-y-auto overscroll-contain rounded-2xl border border-line bg-ink-900/95 p-3 backdrop-blur-xl lg:max-h-[calc(100dvh-6rem)] lg:hidden"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <div className="flex flex-col gap-0.5">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                prefetch={false}
                onClick={closeMenu}
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
            {/* Dedicated XYZ AI launcher (mobile) - transparent glass, live green pulse, 3D robot. */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                window.dispatchEvent(new Event(XYZ_AI_OPEN_EVENT));
              }}
              className="ai-nav-btn mt-0.5 inline-flex items-center gap-2 rounded-lg border border-mint-500/50 bg-transparent px-3 py-2.5 text-sm font-semibold text-mint-700 dark:border-mint-400/40 dark:text-mint-100"
            >
              <span className="relative z-10 inline-flex items-center gap-2">
                <RobotIcon className="ai-bot h-5 w-5" />
                XYZ AI
              </span>
            </button>
            <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3">
              <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                <span className="text-sm font-medium text-zinc-300">Theme</span>
                <ThemeToggle />
              </div>
              {session ? (
                <>
                  <div className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2">
                    <Avatar name={session.user?.name} image={session.user?.image} email={session.user?.email} size="sm" premium={isPremium} />
                    <span className="flex flex-col leading-tight">
                      <span className="mono text-[12px] text-zinc-200">{masked}</span>
                      <span className={cn("text-[10px] font-semibold uppercase tracking-wide", isPremium ? "text-gold-300" : "text-zinc-500")}>
                        {isPremium ? "Premium" : "Free"}
                      </span>
                    </span>
                  </div>
                  <Link href={profileHref} prefetch={false} onClick={() => setOpen(false)} className="btn-ghost">
                    Profile
                  </Link>
                  <Link href="/messages" prefetch={false} onClick={() => setOpen(false)} className="btn-ghost">
                    Messages
                  </Link>
                  <Link href="/journal" prefetch={false} onClick={() => setOpen(false)} className="btn-ghost">
                    Journal
                  </Link>
                  <Link href="/settings" prefetch={false} onClick={() => setOpen(false)} className="btn-ghost">
                    Settings
                  </Link>
                  {canSeeDashboard && (
                    <Link href="/dashboard" prefetch={false} onClick={() => setOpen(false)} className="btn-ghost">
                      Dashboard
                    </Link>
                  )}
                  <DailyCheckIn variant="mobile" />
                  <button onClick={handleSignOut} disabled={signingOut} className="btn-ghost disabled:opacity-60">
                    {signingOut ? "Signing out…" : "Sign out"}
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" prefetch={false} onClick={() => setOpen(false)} className="btn-ghost">
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
      prefetch={false}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-gold-100"
    >
      {icon}
      {children}
    </Link>
  );
}
