"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Wrench, Newspaper, NotebookPen, FileText, MessagesSquare, User } from "lucide-react";
import { Avatar } from "./Avatar";
import { isBottomActive, isBottomHidden } from "@/lib/bottom-nav";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; Icon: typeof Wrench };
const ITEMS: Item[] = [
  { href: "/tools", label: "Tools", Icon: Wrench },
  { href: "/news", label: "News", Icon: Newspaper },
  { href: "/journal", label: "Journal", Icon: NotebookPen },
  { href: "/research", label: "Research", Icon: FileText },
  { href: "/community", label: "Chat", Icon: MessagesSquare },
];

const CELL_CLS = "flex min-h-[52px] flex-col items-center justify-center gap-0.5 py-1.5 transition-colors";

/**
 * App-style bottom navigation for mobile only (md:hidden). Six equal-width
 * targets (five nav links + Profile), all styled identically for a clean,
 * perfectly-aligned row - no special centered treatment for any one cell.
 * Safe-area aware. XYZ AI lives as a floating launcher (see XyzAiWidget.tsx).
 */
export function BottomNav() {
  const pathname = usePathname() || "/";
  const { data: session } = useSession();
  if (isBottomHidden(pathname)) return null;

  const user = session?.user as any;
  const username = user?.username as string | undefined;
  const profileHref = session ? (username ? `/u/${username}` : "/profile") : "/login?callbackUrl=/";
  const profileActive = pathname === "/profile" || pathname.startsWith("/u/");

  return (
    <>
      {/* In-flow spacer so page content + footer clear the fixed bar (only when
          the bar is actually shown - immersive routes above return null). */}
      <div aria-hidden className="h-[calc(3.5rem+env(safe-area-inset-bottom))] md:hidden" />
      <nav
        className="nav-shell fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink-950/95 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary"
      >
      <div className="mx-auto grid max-w-md grid-cols-6">
        {ITEMS.map((it) => (
          <NavCell key={it.href} item={it} active={isBottomActive(pathname, it.href)} />
        ))}
        <Link
          href={profileHref}
          aria-current={profileActive ? "page" : undefined}
          className={cn(CELL_CLS, profileActive ? "text-gold-200" : "text-zinc-500 hover:text-zinc-300")}
        >
          {session ? (
            <Avatar name={user?.name} image={user?.image} email={user?.email} size="sm" />
          ) : (
            <User className="h-5 w-5" />
          )}
          <span className="text-[10px] font-medium">Profile</span>
        </Link>
      </div>
      </nav>
    </>
  );
}

function NavCell({ item, active }: { item: Item; active: boolean }) {
  const { Icon } = item;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(CELL_CLS, active ? "text-gold-200" : "text-zinc-500 hover:text-zinc-300")}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[10px] font-medium">{item.label}</span>
    </Link>
  );
}
