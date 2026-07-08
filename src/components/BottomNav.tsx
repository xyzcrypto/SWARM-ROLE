"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LineChart, Newspaper, FileText, MessagesSquare } from "lucide-react";
import { RobotIcon } from "./RobotIcon";
import { XYZ_AI_OPEN_EVENT } from "./XyzAiWidget";
import { isBottomActive, isBottomHidden } from "@/lib/bottom-nav";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; Icon: typeof LineChart };
const ITEMS: Item[] = [
  { href: "/markets", label: "Markets", Icon: LineChart },
  { href: "/news", label: "News", Icon: Newspaper },
  { href: "/research", label: "Research", Icon: FileText },
  { href: "/community", label: "Chat", Icon: MessagesSquare },
];

/**
 * App-style bottom navigation for mobile only (md:hidden). Five equal targets:
 * two nav links, a centered XYZ AI launcher, two more links. Safe-area aware;
 * the AI floating button is hidden on mobile so this is the single AI entry.
 */
export function BottomNav() {
  const pathname = usePathname() || "/";
  if (isBottomHidden(pathname)) return null;
  const left = ITEMS.slice(0, 2);
  const right = ITEMS.slice(2);

  return (
    <>
      {/* In-flow spacer so page content + footer clear the fixed bar (only when
          the bar is actually shown - immersive routes above return null). */}
      <div aria-hidden className="h-[calc(3.5rem+env(safe-area-inset-bottom))] md:hidden" />
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink-950/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary"
      >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {left.map((it) => (
          <NavCell key={it.href} item={it} active={isBottomActive(pathname, it.href)} />
        ))}
        <button
          onClick={() => window.dispatchEvent(new Event(XYZ_AI_OPEN_EVENT))}
          className="flex flex-col items-center justify-center gap-0.5 py-1.5"
          aria-label="Open XYZ AI"
        >
          <span className="-mt-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-mint-400 to-mint-600 text-ink shadow-lg shadow-mint-500/30 ring-4 ring-ink-950">
            <RobotIcon className="h-6 w-6" />
          </span>
          <span className="text-[10px] font-medium text-mint-300">XYZ AI</span>
        </button>
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
