"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Wrench, Newspaper, FileText, MessagesSquare, User } from "lucide-react";
import { Avatar } from "./Avatar";
import { isBottomActive, isBottomHidden } from "@/lib/bottom-nav";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; Icon: typeof Wrench };
const ITEMS: Item[] = [
  { href: "/tools", label: "Tools", Icon: Wrench },
  { href: "/news", label: "News", Icon: Newspaper },
  { href: "/research", label: "Research", Icon: FileText },
  { href: "/community", label: "Chat", Icon: MessagesSquare },
];

/**
 * App-style bottom navigation for mobile only (md:hidden). Five equal
 * targets: two nav links, a centered Profile entry, two more links. Safe-area
 * aware. XYZ AI now lives as a floating launcher visible on mobile too (see
 * XyzAiWidget.tsx), freeing this center slot for direct profile access.
 */
export function BottomNav() {
  const pathname = usePathname() || "/";
  const { data: session } = useSession();
  if (isBottomHidden(pathname)) return null;
  const left = ITEMS.slice(0, 2);
  const right = ITEMS.slice(2);

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
      <div className="mx-auto grid max-w-md grid-cols-5">
        {left.map((it) => (
          <NavCell key={it.href} item={it} active={isBottomActive(pathname, it.href)} />
        ))}
        <Link
          href={profileHref}
          aria-current={profileActive ? "page" : undefined}
          className={cn(
            "flex min-h-[52px] flex-col items-center justify-center gap-0.5 py-1.5 transition-colors",
            profileActive ? "text-gold-200" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          {session ? (
            <Avatar name={user?.name} image={user?.image} email={user?.email} size="sm" />
          ) : (
            <User className="h-5 w-5" />
          )}
          <span className="text-[10px] font-medium">Profile</span>
        </Link>
        {right.map((it) => (
          <NavCell key={it.href} item={it} active={isBottomActive(pathname, it.href)} />
        ))}
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
      className={cn(
        "flex min-h-[52px] flex-col items-center justify-center gap-0.5 py-1.5 transition-colors",
        active ? "text-gold-200" : "text-zinc-500 hover:text-zinc-300"
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[10px] font-medium">{item.label}</span>
    </Link>
  );
}
