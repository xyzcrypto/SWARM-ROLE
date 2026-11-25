"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { Award, BookOpen, GraduationCap, Radio, Swords, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAudio } from "../client/hooks";
import { say, sfx, unlock, updateSettings } from "../client/audio";
import { HINGLISH_READY } from "../client/hinglish-ready";

const TABS = [
  { href: "/academy", label: "Academy", icon: GraduationCap, exact: true },
  { href: "/academy/learn", label: "Learn", icon: BookOpen },
  { href: "/academy/quiz", label: "Quiz", icon: Swords },
  { href: "/academy/live", label: "Live", icon: Radio },
  { href: "/academy/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/academy/certificates", label: "Certificates", icon: Award },
];

/** English / Hinglish switch for lessons, quizzes and AneQue's voice. */
function LangSwitch() {
  const { settings } = useAudio();
  const set = (lang: "en" | "hi") => {
    unlock();
    if (settings.lang === lang) return;
    sfx("click");
    updateSettings({ lang });
    // Tell the learner in the language they just picked.
    setTimeout(() => say(lang === "hi" ? "lang_hi" : "lang_en"), 60);
  };
  return (
    <div role="radiogroup" aria-label="Academy language" className="flex shrink-0 items-center rounded-full border border-hairline bg-ink-900/60 p-1 backdrop-blur">
      {(
        [
          ["en", "EN"],
          ["hi", "Hinglish"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={settings.lang === id}
          onClick={() => set(id)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-bold transition-colors sm:py-2 sm:text-[13px]",
            settings.lang === id ? "bg-gold-400 text-ink-950" : "text-content-muted hover:text-content"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** The Academy's own tab bar. Scrolls sideways on small screens rather than wrapping. */
export function AcademyNav() {
  const path = usePathname() ?? "";
  return (
    <nav aria-label="Academy" className="acad-noprint acad-nav-scroll -mx-5 mb-5 flex items-center gap-2 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:mb-8 sm:px-0 [&::-webkit-scrollbar]:hidden">
      {HINGLISH_READY && <LangSwitch />}
      <ul className="isolate flex w-max items-center gap-1 rounded-full border border-hairline bg-ink-900/60 p-1 backdrop-blur">
        {TABS.map((t) => {
          const active = t.exact ? path === t.href : path === t.href || path.startsWith(`${t.href}/`);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:px-3.5 sm:py-2 sm:text-[13px]",
                  active ? "text-gold-200" : "text-content-muted hover:text-content"
                )}
              >
                {/* The active pill slides from tab to tab instead of blinking between them. */}
                {active && (
                  <motion.span
                    layoutId="acad-tab-pill"
                    className="absolute inset-0 -z-10 rounded-full bg-gold-400/15 shadow-[inset_0_0_0_1px_rgba(226,167,47,0.35),0_6px_20px_-8px_rgba(226,167,47,0.5)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
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
