"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Bookmark, BookOpen, Coins, Crown, Home, LayoutDashboard, LineChart, LogOut, Mail, Menu,
  MessageCircle, Newspaper, NotebookPen, Search, Settings, SlidersHorizontal, Trophy, GraduationCap, User, Users, Wrench, X,
} from "lucide-react";
import { openCustomize } from "@shared/utils/site-prefs";
import { navLinks } from "@/lib/site";
import { XYZ_CMDK_EVENT } from "@/lib/command-search";
import { XYZ_AI_OPEN_EVENT } from "@modules/ai/lib/events";
import { RobotIcon } from "@/components/RobotIcon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar } from "@/components/Avatar";
import { isStaff } from "@/lib/permissions";
import { cn, maskEmail } from "@/lib/utils";
import { useScrollLock } from "@shared/hooks/useScrollLock";
import { hapticTap } from "@shared/utils/haptics";

const ICONS: Record<string, typeof Home> = {
  "/": Home,
  "/markets": LineChart,
  "/points": Coins,
  "/tools": Wrench,
  "/news": Newspaper,
  "/creators": Trophy,
  "/academy": GraduationCap,
  "/saved": Bookmark,
  "/community": Users,
  "/premium": Crown,
  "/contact": Mail,
};

/**
 * The whole site navigation behind one button, for the immersive chat and DM
 * screens.
 *
 * Those two pages drop the fixed site header entirely (logo, rail, search) so
 * the conversation can have the full height of the screen - the same thing
 * every messenger does. Nothing becomes unreachable: this drawer renders the
 * COMPLETE `navLinks` list plus the account links, search, theme and XYZ AI,
 * i.e. everything the header carried.
 *
 * Portalled to <body>: the chat shells are `overflow-hidden`, and a fixed child
 * of an overflow-hidden ancestor that creates a containing block is clipped.
 */
export function AppMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || "/";
  const { data: session } = useSession();
  const user = session?.user as { name?: string | null; image?: string | null; email?: string | null; username?: string; membership?: string } | undefined;
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useScrollLock(open);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    // Same DOM flag the site header sets, so the floating XYZ AI launcher gets
    // out of the way of the drawer (see `html[data-nav-open] .ai-fab`).
    document.documentElement.setAttribute("data-nav-open", "");
    const trigger = triggerRef.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.removeAttribute("data-nav-open");
      trigger?.focus();
    };
  }, [open]);

  // Navigating closes it: the drawer is a way to leave, not a place to stay.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  const close = () => setOpen(false);
  const premium = user?.membership === "Premium";
  const profileHref = user?.username ? `/u/${user.username}` : "/profile";

  const row = (href: string, label: string, Icon: typeof Home) => (
    <Link
      key={href}
      href={href}
      prefetch={false}
      onClick={close}
      aria-current={isActive(href) ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors",
        isActive(href) ? "bg-gold-500/10 text-gold-100 ring-1 ring-gold-500/25" : "text-zinc-300 hover:bg-white/[0.05] hover:text-zinc-50"
      )}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive(href) ? "text-gold-300" : "text-zinc-500 group-hover:text-zinc-300")} strokeWidth={1.8} />
      {label}
    </Link>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => { hapticTap(); setOpen(true); }}
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-hairline text-zinc-300 transition-colors hover:border-gold-500/30 hover:text-zinc-50 active:scale-95",
          className
        )}
      >
        <Menu className="h-[18px] w-[18px]" strokeWidth={1.8} />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Site menu">
          <button type="button" aria-label="Close menu" tabIndex={-1} onClick={close} className="app-fade-in absolute inset-0 cursor-default bg-black/60 backdrop-blur-[2px]" />
          <nav
            className="app-drawer-in absolute inset-y-0 left-0 flex w-[min(320px,86vw)] flex-col border-r border-hairline bg-ink-900 shadow-2xl shadow-black/60"
            style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
              <Link href="/" onClick={close} className="flex items-center gap-2.5">
                <span className="relative inline-flex h-9 w-9">
                  <Image src="/logo.png" alt="" fill className="object-contain" sizes="36px" />
                </span>
                <span className="font-display text-[15px] font-semibold tracking-tight">
                  <span className="text-gold-gradient">XYZ</span> <span className="text-zinc-100">Crypto</span>
                </span>
              </Link>
              <button ref={closeRef} type="button" onClick={close} aria-label="Close menu" className="grid h-10 w-10 place-items-center rounded-xl text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-zinc-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 pb-2">
              <button
                type="button"
                onClick={() => { close(); window.dispatchEvent(new Event(XYZ_CMDK_EVENT)); }}
                className="flex w-full items-center gap-2.5 rounded-xl border border-hairline bg-white/[0.03] px-3 py-2.5 text-left text-[13px] text-zinc-500 transition-colors hover:border-gold-500/30 hover:text-zinc-300"
              >
                <Search className="h-4 w-4" />
                Search XYZ Crypto
                <kbd className="mono ml-auto hidden rounded border border-hairline px-1.5 text-[10px] sm:inline">⌘K</kbd>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
              <p className="mono px-3 pb-1 pt-3 text-[10px] uppercase tracking-[0.16em] text-zinc-600">Chat</p>
              {row("/community", "Community", Users)}
              {row("/messages", "Messages", MessageCircle)}

              <p className="mono px-3 pb-1 pt-4 text-[10px] uppercase tracking-[0.16em] text-zinc-600">Explore</p>
              {navLinks.filter((l) => l.href !== "/community").map((l) => row(l.href, l.label, ICONS[l.href] ?? Home))}
              <button
                type="button"
                onClick={() => { close(); window.dispatchEvent(new Event(XYZ_AI_OPEN_EVENT)); }}
                className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold text-mint-700 transition-colors hover:bg-mint-500/10 dark:text-mint-200"
              >
                <RobotIcon className="h-[18px] w-[18px]" />
                XYZ AI
              </button>

              {session && (
                <>
                  <p className="mono px-3 pb-1 pt-4 text-[10px] uppercase tracking-[0.16em] text-zinc-600">You</p>
                  {row(profileHref, "Profile", User)}
                  {row("/journal", "Journal", NotebookPen)}
                  {row("/settings", "Settings", Settings)}
                  {isStaff(session.user as never) && row("/dashboard", "Dashboard", LayoutDashboard)}
                </>
              )}
            </div>

            <div className="space-y-2 border-t border-hairline px-4 py-3">
              <button
                type="button"
                onClick={() => { close(); openCustomize(); }}
                className="flex w-full items-center gap-2.5 rounded-xl bg-gold-500/10 px-3 py-2.5 text-left text-[13px] font-semibold text-gold-100 ring-1 ring-gold-500/25 transition-colors hover:bg-gold-500/15"
              >
                <SlidersHorizontal className="h-4 w-4 text-gold-300" />
                Customize website
              </button>
              <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2">
                <span className="text-[13px] font-medium text-zinc-300">Theme</span>
                <ThemeToggle />
              </div>
              {session ? (
                <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2">
                  <Avatar name={user?.name} image={user?.image} email={user?.email} size="sm" premium={premium} />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="mono block truncate text-[12px] text-zinc-200">{maskEmail(user?.email)}</span>
                    <span className={cn("text-[10px] font-semibold uppercase tracking-wide", premium ? "text-gold-300" : "text-zinc-500")}>{premium ? "Premium" : "Free"}</span>
                  </span>
                  <button
                    type="button"
                    onClick={async () => { try { await signOut({ redirect: false }); } finally { window.location.href = "/"; } }}
                    aria-label="Sign out"
                    title="Sign out"
                    className="grid h-9 w-9 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-zinc-200"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <Link href="/login" onClick={close} className="btn-primary block text-center">Log in</Link>
              )}
            </div>
          </nav>
        </div>,
        document.body
      )}
    </>
  );
}
