"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, BookOpen, GraduationCap, Radio, Swords, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/academy", label: "Academy", icon: GraduationCap, exact: true },
  { href: "/academy/learn", label: "Learn", icon: BookOpen },
  { href: "/academy/quiz", label: "Quiz", icon: Swords },
  { href: "/academy/live", label: "Live", icon: Radio },
  { href: "/academy/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/academy/certificates", label: "Certificates", icon: Award },
];

/** The Academy's own tab bar. Scrolls sideways on small screens rather than wrapping. */
export function AcademyNav() {
  const path = usePathname() ?? "";
  return (
    <nav aria-label="Academy" className="acad-noprint -mx-5 mb-6 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <ul className="flex w-max items-center gap-1 rounded-full border border-hairline bg-ink-900/60 p-1 backdrop-blur">
        {TABS.map((t) => {
          const active = t.exact ? path === t.href : path === t.href || path.startsWith(`${t.href}/`);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition-colors sm:text-[13px]",
                  active ? "bg-gold-400/15 text-gold-200 shadow-[inset_0_0_0_1px_rgba(226,167,47,0.35)]" : "text-content-muted hover:text-content"
                )}
              >
                <t.icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
