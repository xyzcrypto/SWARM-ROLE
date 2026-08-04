"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Wrench, Newspaper, NotebookPen, LineChart, FileText, User } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { isBottomActive, isBottomHidden } from "@/lib/bottom-nav";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; Icon: typeof Wrench };
// Chat isn't listed here - it's already one tap away via the navbar's chat
// bubble icon (top of every page), so a dedicated bottom-nav slot was
// redundant. Markets takes that slot back instead.
const ITEMS: Item[] = [
  { href: "/tools", label: "Tools", Icon: Wrench },
  { href: "/news", label: "News", Icon: Newspaper },
  { href: "/journal", label: "Journal", Icon: NotebookPen },
  { href: "/research", label: "Research", Icon: FileText },
  { href: "/markets", label: "Markets", Icon: LineChart },
];

// Sizing is fluid rather than fixed, so one rule covers every screen instead of
// a breakpoint per device. `clamp(min, preferred, max)` lets the browser scale
// against the actual viewport: the middle term is in `vw`, so a 320px phone and
// a 430px phone each get a proportionate size, and the outer terms stop it
// becoming unreadable or oversized. Nothing here is device-specific.
const CELL_CLS =
  "flex min-h-[clamp(48px,13vw,56px)] flex-col items-center justify-center gap-0.5 py-1.5 transition-colors";
// Labels shrink on narrow phones instead of wrapping or clipping. `truncate`
// plus `w-full` is the guard: a longer label degrades to an ellipsis rather
// than pushing the six columns out of the viewport.
const LABEL_CLS = "w-full truncate px-0.5 text-center text-[clamp(9px,2.5vw,11px)] font-medium leading-tight";
const ICON_CLS = "h-[clamp(18px,5vw,20px)] w-[clamp(18px,5vw,20px)] shrink-0";

/**
 * App-style bottom navigation for mobile only (md:hidden). Two links, a
 * raised centered Profile button (bigger than the rest - the one cell meant
 * to stand out), then three more links. Safe-area aware. XYZ AI lives as a
 * floating launcher (see XyzAiWidget.tsx).
 */
export function BottomNav() {
  const pathname = usePathname() || "/";
  const { data: session } = useSession();
  if (isBottomHidden(pathname)) return null;
  const left = ITEMS.slice(0, 2);
  const right = ITEMS.slice(2);

  const user = session?.user as any;
  const isPremium = user?.membership === "Premium";
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
      {/* max-w-lg (not md) so the six cells still have room on a large phone,
          and the grid fills the width below that instead of leaving side gaps.
          On a tablet the cap keeps it from stretching absurdly wide - though
          the bar is md:hidden, so that only applies to small tablets. */}
      <div className="mx-auto grid w-full max-w-lg grid-cols-6">
        {left.map((it) => (
          <NavCell key={it.href} item={it} active={isBottomActive(pathname, it.href)} />
        ))}
        <Link
          href={profileHref}
          prefetch={false}
          aria-current={profileActive ? "page" : undefined}
          className="flex flex-col items-center justify-center gap-0.5 py-1"
        >
          <span
            className={cn(
              // Fluid too, and for a concrete reason: at a fixed 56px this
              // circle was wider than its own grid cell on a 320px screen
              // (320 / 6 ≈ 53px), so it overflowed into its neighbours.
              "-mt-5 flex h-[clamp(44px,14vw,56px)] w-[clamp(44px,14vw,56px)] items-center justify-center rounded-full border-2 bg-ink-950 shadow-lg transition-colors",
              profileActive ? "border-gold-400 shadow-gold-500/30" : "border-white/15 shadow-black/40"
            )}
          >
            {session ? (
              <Avatar name={user?.name} image={user?.image} email={user?.email} size="md" ring={false} premium={isPremium} />
            ) : (
              <User className="h-[clamp(20px,6vw,24px)] w-[clamp(20px,6vw,24px)] text-zinc-300" />
            )}
          </span>
          <span className={cn(LABEL_CLS, profileActive ? "text-gold-200" : "text-zinc-500")}>Profile</span>
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
      prefetch={false}
      aria-current={active ? "page" : undefined}
      className={cn(CELL_CLS, active ? "text-gold-200" : "text-zinc-500 hover:text-zinc-300")}
    >
      <Icon className={ICON_CLS} />
      <span className={LABEL_CLS}>{item.label}</span>
    </Link>
  );
}
